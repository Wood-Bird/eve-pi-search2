using System;
using SkiaSharp;

namespace EVESovMap.Rendering
{
    public static class MapRenderUtils
    {
        public static SKPoint EveCartesianToScreenPoint(double x, double y)
        {
            var xCoord = Math.Floor((x / MapConstants.SCALE ) + (MapConstants.HORIZONTAL_SIZE / 2) + MapConstants.HORIZONTAL_OFFSET) + 0.5;
            var yCoord = Math.Floor((MapConstants.VERTICAL_SIZE / 2) - (y / MapConstants.SCALE) + MapConstants.VERTICAL_OFFSET) + 0.5;

            return new SKPoint((float)xCoord, (float)yCoord);
        }
    }
}