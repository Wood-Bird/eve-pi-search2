using EVESovMap.Rendering;

namespace EVESovMap
{
    class Program
    {
        static void Main(string[] args)
        {

            // TODO: https://github.com/viceroypenguin/RBush
            // TODO: https://blog.mapbox.com/a-dive-into-spatial-search-algorithms-ebd0c5e39d2a
            var dataLoader = new MapDataLoader();
            var mapDataContext = dataLoader.LoadData();
            var mapRenderer = new MapRenderer(mapDataContext);

            mapRenderer.Render();
        }
    }
}
