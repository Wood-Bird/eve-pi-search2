using System;
using System.Security.Cryptography;
using System.Text;
using SkiaSharp;

namespace EVESovMap.Rendering
{
    public class SolarSystemsMapRenderTask : IMapRenderTask
    {
        public void Render(SKCanvas canvas, MapDataContext mapDataContext)
        {
            using (var paint = new SKPaint())
            {
                paint.Style = SKPaintStyle.StrokeAndFill;
                paint.IsAntialias = true;

                foreach(var solarSystem in mapDataContext.SolarSystems)
                {
                    if (solarSystem.allianceID != null && solarSystem.allianceID != 0)
                    {
                        var md5 = MD5.Create();
                        var hash = md5.ComputeHash(Encoding.UTF8.GetBytes(solarSystem.allianceID.ToString()));
                        paint.Color = new SKColor(hash[0], hash[1], hash[2]);
                        canvas.DrawOval(MapRenderUtils.EveCartesianToScreenPoint(solarSystem.x, solarSystem.z), new SKSize(2.0f, 1.0f), paint);
                    }
                    else
                    {
                        paint.Color = new SKColor(0xB0, 0xB0, 0xFF);
                        canvas.DrawOval(MapRenderUtils.EveCartesianToScreenPoint(solarSystem.x, solarSystem.z), new SKSize(1.0f, 0.5f), paint);
                    }
                    
                    // paint.Color = new SKColor(randomBytes[0], randomBytes[1], randomBytes[2]);
                    
                }
                canvas.DrawLine(new SKPoint(0.0f, 0.0f), new SKPoint(100.0f, 100.0f), paint);
            }

        }
    }
}