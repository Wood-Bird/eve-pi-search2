using SkiaSharp;

namespace EVESovMap.Rendering
{
    public interface IMapRenderTask
    {
        void Render(SKCanvas canvas, MapDataContext mapDataContext);
    }
}

