using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using SkiaSharp;
using MIConvexHull;

namespace EVESovMap.Rendering
{
    public class VoronoiSovMapRenderTask : IMapRenderTask
    {
        public void Render(SKCanvas canvas, MapDataContext mapDataContext)
        {
            var solarSystemVertexes = new List<SolarSystemVertex>();
            foreach(var solarSystem in mapDataContext.SolarSystems)
            {
                solarSystemVertexes.Add(new SolarSystemVertex(solarSystem));
            }

            var voronoiMesh = VoronoiMesh.Create<SolarSystemVertex, SolarySystemTriangulationCell>(solarSystemVertexes);
            var voronoiCells = CreateVoronoiCells(voronoiMesh);

            using (var paint = new SKPaint())
            {
                paint.Style = SKPaintStyle.Fill;
                paint.IsAntialias = true;

                foreach(var cell in voronoiCells)
                {
                    var solarSystem = cell.SolarSystemVertex.SolarSystem;
                    var cellVertices = cell.SolarSystemVoronoiEdges;
                    var points = SortVertices(cellVertices.SelectMany(x => new List<SKPoint>() {x.PointOne, x.PointTwo}).Distinct().ToList()).ToArray();
                    
                    if (solarSystem.allianceID != null && solarSystem.allianceID != 0)
                    {
                        var md5 = MD5.Create();
                        var hash = md5.ComputeHash(Encoding.UTF8.GetBytes(solarSystem.allianceID.ToString()));
                        paint.Color = new SKColor(hash[0], hash[1], hash[2]).WithAlpha(60);

                        var path = new SKPath();
                        
                        // for (var i = 0; i < cellVertices.Count(); i++)
                        // {
                        //     path.MoveTo(cellVertices[i].PointOne);
                        //     path.LineTo(cellVertices[i].PointTwo);
                        // }

                        path.MoveTo(points.First());
                        for(var i = 0; i < points.Count(); i++)
                        {
                            path.LineTo(points[i]);
                        }
                        path.LineTo(points.First());

                        canvas.DrawPath(path, paint);

                        // canvas.DrawPoints(SKPointMode.Polygon, points, paint);
                    }
                    else
                    {
                        paint.Color = new SKColor(0xB0, 0xB0, 0xFF).WithAlpha(50);
                        var path = new SKPath();
                        for (var i = 0; i < cellVertices.Count(); i++)
                        {
                            path.MoveTo(cellVertices[i].PointOne);
                            path.LineTo(cellVertices[i].PointTwo);
                        }

                        // canvas.DrawPath(path, paint);
                    }
                    
                    // paint.Color = new SKColor(randomBytes[0], randomBytes[1], randomBytes[2]);
                    
                }
                canvas.DrawLine(new SKPoint(0.0f, 0.0f), new SKPoint(100.0f, 100.0f), paint);
            }
        }

        public List<SolarSystemVoronoiCell> CreateVoronoiCells(MIConvexHull.VoronoiMesh<SolarSystemVertex, SolarySystemTriangulationCell, VoronoiEdge<SolarSystemVertex, SolarySystemTriangulationCell>> mesh)
        {
            var solarSystemVoronoiCells = new List<SolarSystemVoronoiCell>();
            var solarSystemVoronoiEdges = new List<SolarSystemVoronoiEdge>();

            var triangulationEdges = mesh.Edges;
            foreach (var triangulationEdge in triangulationEdges)
            {
                var solarSystemVoronoiEdge = new SolarSystemVoronoiEdge(triangulationEdge.Source.Circumcenter, triangulationEdge.Target.Circumcenter);
                var systemsForVoronoiEdge = triangulationEdge.Source.Vertices
                    .Select(x => x)
                    .Intersect(triangulationEdge.Target.Vertices.Select(x => x).ToList());
                solarSystemVoronoiEdge.SolarSystemVertexes.AddRange(systemsForVoronoiEdge);
                solarSystemVoronoiEdges.Add(solarSystemVoronoiEdge);

                foreach(var system in solarSystemVoronoiEdge.SolarSystemVertexes)
                {
                    var cell = solarSystemVoronoiCells.FirstOrDefault(x => x.SolarSystemVertex == system);
                    if (cell == null)
                    {
                        cell = new SolarSystemVoronoiCell() { SolarSystemVertex = system };
                        cell.SolarSystemVoronoiEdges.Add(solarSystemVoronoiEdge);
                        solarSystemVoronoiCells.Add(cell);
                    }
                    else
                    {
                        cell.SolarSystemVoronoiEdges.Add(solarSystemVoronoiEdge);
                    }
                }
            }

            return solarSystemVoronoiCells;
        }

        public SKPoint FindCentroid(List<SKPoint> points) {
            double x = 0;
            double y = 0;
            foreach(var p in points) {
                x += p.X;
                y += p.Y;
            }
            SKPoint center = new SKPoint((float)(x / points.Count), (float)(y / points.Count));
            return center;
        }

        public List<SKPoint> SortVertices(List<SKPoint> points) {
            // get centroid
            SKPoint center = FindCentroid(points);
            points.Sort((a, b) => 
            {
                double a1 = ((180/Math.PI) * (Math.Atan2(a.X - center.X, a.Y - center.Y)) + 360) % 360;
                double a2 = ((180/Math.PI) * (Math.Atan2(b.X - center.X, b.Y - center.Y)) + 360) % 360;
                return (int) (a1 - a2);
            });
            return points;
        }
    }

    public class SolarSystemVoronoiEdge
    {
        public SKPoint PointOne { get; set;}
        public SKPoint PointTwo {get; set;}
        public List<SolarSystemVertex> SolarSystemVertexes {get; set;}

        public SolarSystemVoronoiEdge(SKPoint p1, SKPoint p2)
        {
            this.PointOne = p1;
            this.PointTwo = p2;

            SolarSystemVertexes = new List<SolarSystemVertex>();
        }
    }

    public class SolarSystemVoronoiCell
    {
        public SolarSystemVertex SolarSystemVertex {get; set;}
        public List<SolarSystemVoronoiEdge> SolarSystemVoronoiEdges { get; set;} = new List<SolarSystemVoronoiEdge>();
    }

    public class SolarSystemVertex : IVertex
    {
        public SolarSystemVertex(SolarSystem solarSystem)
        {
            SolarSystem = solarSystem;
            Point = MapRenderUtils.EveCartesianToScreenPoint(solarSystem.x, solarSystem.z);
            Position = new double[] {Point.X, Point.Y};

        }
        public SolarSystem SolarSystem {get; set;}

        public SKPoint Point {get;}
        public double[] Position { get; private set;}
    }


    public class SolarySystemTriangulationCell : TriangulationCell<SolarSystemVertex, SolarySystemTriangulationCell>
    {
        double Det(double[,] m)
        {
            return m[0, 0] * ((m[1, 1] * m[2, 2]) - (m[2, 1] * m[1, 2])) - m[0, 1] * (m[1, 0] * m[2, 2] - m[2, 0] * m[1, 2]) + m[0, 2] * (m[1, 0] * m[2, 1] - m[2, 0] * m[1, 1]);
        }

        double LengthSquared(double[] v)
        {
            double norm = 0;
            for (int i = 0; i < v.Length; i++)
            {
                var t = v[i];
                norm += t * t;
            }
            return norm;
        }

        SKPoint GetCircumcenter()
        {
            // From MathWorld: http://mathworld.wolfram.com/Circumcircle.html

            var points = Vertices;

            double[,] m = new double[3, 3];

            // x, y, 1
            for (int i = 0; i < 3; i++)
            {
                m[i, 0] = points[i].Position[0];
                m[i, 1] = points[i].Position[1];
                m[i, 2] = 1;
            }
            var a = Det(m);

            // size, y, 1
            for (int i = 0; i < 3; i++)
            {
                m[i, 0] = LengthSquared(points[i].Position);
            }
            var dx = -Det(m);

            // size, x, 1
            for (int i = 0; i < 3; i++)
            {
                m[i, 1] = points[i].Position[0];
            }
            var dy = Det(m);

            // size, x, y
            for (int i = 0; i < 3; i++)
            {
                m[i, 2] = points[i].Position[1];
            }
            var c = -Det(m);

            var s = -1.0 / (2.0 * a);
            var r = System.Math.Abs(s) * System.Math.Sqrt(dx * dx + dy * dy - 4 * a * c);
            return new SKPoint((float)(s * dx), (float)(s * dy));
        }

        SKPoint? circumCenter;
        public SKPoint Circumcenter
        {
            get
            {
                circumCenter = circumCenter ?? GetCircumcenter();
                return circumCenter.Value;
            }
        }
    }
}