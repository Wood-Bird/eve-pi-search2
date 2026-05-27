using System.IO;
using SkiaSharp;

namespace EVESovMap.Rendering
{
    public class MapRenderer
    {
        private readonly MapRendererConfig _config;
        private readonly MapDataContext _dataContext;
        public MapRenderer(MapDataContext dataContext) : this(MapRendererConfig.Default(), dataContext) {}
        public MapRenderer(MapRendererConfig config, MapDataContext dataContext)
        {
            _config = config;
            _dataContext = dataContext;
        }

        public void Render()
        {
            var regionNamesRenderTask = new RegionNamesMapRenderTask();
            var solarSystemsMapRenderTask = new SolarSystemsMapRenderTask();
            var solarSystemJumpsMapRenderTask = new SolarSystemJumpsMapRenderTask();
            var voronoiSovMapRenderTask = new VoronoiSovMapRenderTask();

            var imageInfo = new SKImageInfo(MapConstants.HORIZONTAL_SIZE, MapConstants.VERTICAL_SIZE, SKImageInfo.PlatformColorType, SKAlphaType.Premul);

            using (var surface = SKSurface.Create(imageInfo)) {
                SKCanvas myCanvas = surface.Canvas;
                myCanvas.Clear(SKColors.Black);

                using (var paint = new SKPaint())
                {
                    // paint.Style = SKPaintStyle.StrokeAndFill;
                    // paint.Color = new SKColor(0xB0, 0xB0, 0xFF);
                    // paint.IsAntialias = true;

                    voronoiSovMapRenderTask.Render(myCanvas, _dataContext);
                    solarSystemJumpsMapRenderTask.Render(myCanvas, _dataContext);
                    solarSystemsMapRenderTask.Render(myCanvas, _dataContext);
                    regionNamesRenderTask.Render(myCanvas, _dataContext);
                    
                    

                    using (SKImage image = surface.Snapshot())
                    using (SKData data = image.Encode(SKEncodedImageFormat.Png, 100))
                    using (var fileStream = File.Create("sovMap.png"))
                    {
                        fileStream.Write(data.ToArray(), 0, data.ToArray().Length);
                    }                              
                }

                // Your drawing code goes here.
            }           
        }
    }

    public class MapRendererConfig
    {
        // Future config options

        public static MapRendererConfig Default()
        {
            return new MapRendererConfig();
        }
    }
}