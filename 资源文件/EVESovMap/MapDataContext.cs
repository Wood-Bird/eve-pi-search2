
using System.Collections.Generic;
using RBush;

namespace EVESovMap
{
    public class MapDataContext
    {
        public List<SolarSystem> SolarSystems {get; set;} = new List<SolarSystem>();
        public List<SolarSystemJumps> SolarSystemJumps {get; set;} = new List<SolarSystemJumps>();
        public List<Region> Regions {get; set;} = new List<Region>();
    }

    
    public class SolarSystem
    {
        public int solarSystemID {get; set;}
        public double x {get; set;}
        public double y {get; set;}
        public double z {get; set;}

        public int? allianceID {get; set;}
    }

    public class SolarSystemJumps
    {
        public string fromRegionID {get; set;}
        public string fromConstellationID {get; set;}
        public int fromSolarSystemID {get; set;}
        public int toSolarSystemID {get; set;}
        public string toConstellationID {get; set;}
        public string toRegionID {get; set;}

        public bool IsConstellationJump => (fromConstellationID != toConstellationID) && !IsRegionalJump;
        public bool IsRegionalJump => fromRegionID != toRegionID;
    }

    public class Region
    {
        public string regionID { get; set;}
        public string regionName {get; set;}
        public double x {get; set;}
        public double y {get; set;}
        public double z {get; set;}
    }
}