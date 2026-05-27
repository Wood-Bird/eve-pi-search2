namespace EVESovMap
{
    public static class MapConstants
    {	
        //	Sample rate for text placement algorithm, samples every sampleRate pixels
        public static int SAMPLE_RATE = 8; 

        //	width
        public static int HORIZONTAL_SIZE = 928*2;
        
        //	height
        public static int VERTICAL_SIZE = 1024*2;
        
        //	vertical offset
        public static int HORIZONTAL_OFFSET = 208;
        
        //	horizontal offset
        public static int VERTICAL_OFFSET = 0;
        
        //	Scaling factor
        public static double SCALE = 4.8445284569785E17/((VERTICAL_SIZE - 20) / 2.0);
    }
}