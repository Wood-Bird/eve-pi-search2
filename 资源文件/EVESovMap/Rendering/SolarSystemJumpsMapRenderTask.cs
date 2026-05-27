using System.Linq;
using SkiaSharp;

namespace EVESovMap.Rendering
{
    public class SolarSystemJumpsMapRenderTask : IMapRenderTask
    {
        public void Render(SKCanvas canvas, MapDataContext mapDataContext)
        {
            using (var paint = new SKPaint())
            {
                paint.Style = SKPaintStyle.Stroke;
                paint.Color = new SKColor(0xB0, 0xB0, 0xFF, 0x1E);
                paint.IsAntialias = true;
                foreach (var solarSystemJump in mapDataContext.SolarSystemJumps)
                {
                    var fromSolarSystem = mapDataContext.SolarSystems.First(x => x.solarSystemID == solarSystemJump.fromSolarSystemID);
                    var toSolarSystem = mapDataContext.SolarSystems.First(x => x.solarSystemID == solarSystemJump.toSolarSystemID);

                    if (solarSystemJump.IsRegionalJump)
                    {
                        paint.Color = SKColors.LightPink.WithAlpha(0x1E);
                    }
                    else if (solarSystemJump.IsConstellationJump)
                    {
                        paint.Color = SKColors.Red.WithAlpha(0x1E);
                    }
                    else
                    {
                        paint.Color = SKColors.Blue.WithAlpha(0x1E);
                    }


                    canvas.DrawLine(MapRenderUtils.EveCartesianToScreenPoint(fromSolarSystem.x, fromSolarSystem.z), MapRenderUtils.EveCartesianToScreenPoint(toSolarSystem.x, toSolarSystem.z), paint);
                }
            }
            
        }
    }
}