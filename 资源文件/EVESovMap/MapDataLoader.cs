using System.IO;
using System.Linq;
using CsvHelper;
using CsvHelper.Configuration;
using ESI.NET;
using ESI.NET.Enumerations;
using Microsoft.Extensions.Options;

namespace EVESovMap
{
    public class MapDataLoader
    {
        private readonly EsiClient _esiClient;
        public MapDataLoader()
        {
            IOptions<EsiConfig> config = Options.Create(new EsiConfig()
            {
                EsiUrl = "https://esi.evetech.net/",
                DataSource = DataSource.Tranquility,
                ClientId = "a3c88000c6ac4de5b31f85d1e4db7c11",
                SecretKey = "n3cLN6yUZ4pgDoxvQ7dMJ6bfMRPdvr3rdFVwKEEO",
                CallbackUrl = "eveauth-app://callback/",
                UserAgent = "Niedar"
            });

            _esiClient = new EsiClient(config);            
        }
        public MapDataContext LoadData()
        {
            var mapDataContext = new MapDataContext();

            var csvConfiguration = new Configuration();
            csvConfiguration.HeaderValidated = null;
            csvConfiguration.MissingFieldFound = null;
            using (var reader = new StreamReader("mapSolarSystems.csv"))
            using (var csvReader = new CsvReader(reader, csvConfiguration))
            {
                mapDataContext.SolarSystems = csvReader.GetRecords<SolarSystem>().ToList();
            }
            using (var reader = new StreamReader("mapSolarSystemJumps.csv"))
            using (var csvReader = new CsvReader(reader, csvConfiguration))
            {
                mapDataContext.SolarSystemJumps = csvReader.GetRecords<SolarSystemJumps>().ToList();
            }
            using (var reader = new StreamReader("mapRegions.csv"))
            using (var csvReader = new CsvReader(reader, csvConfiguration))
            {
                mapDataContext.Regions = csvReader.GetRecords<Region>().ToList();
            }

            // var result = _esiClient.Sovereignty.Systems().Result;
            // var sovSystems = result.Data;

            // foreach (var sovSystem in sovSystems)
            // {
            //     mapDataContext.SolarSystems.First(x => x.solarSystemID == sovSystem.SystemId).allianceID = sovSystem.AllianceId;
            // }

            
            foreach (var solarySystems in mapDataContext.SolarSystems)
            {
               solarySystems.allianceID = 1;
            }

            return mapDataContext;
        }
    }
}
