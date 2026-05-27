using SkiaSharp;

namespace EVESovMap.Rendering
{
    public class RegionNamesMapRenderTask : IMapRenderTask
    {
        public void Render(SKCanvas canvas, MapDataContext mapDataContext)
        {
            using (var paint = new SKPaint())
            {
                paint.Style = SKPaintStyle.StrokeAndFill;
                paint.Color = SKColors.White.WithAlpha(0x7E);
                paint.IsAntialias = true;
                paint.TextSize = 12.0f;
                foreach (var region in mapDataContext.Regions)
                {
                    canvas.DrawText(region.regionName, MapRenderUtils.EveCartesianToScreenPoint(region.x, region.z), paint);
                }
            }
        }
    }
}