// Curated SEPTA station list with WGS-84 coordinates.
// Regional Rail coords from the SEPTA GTFS rail feed cross-referenced against
// OpenStreetMap. BSL coords pinned to the Broad Street centerline (lon ~ -75.164
// north of Vine, drifting to -75.173 at the south terminus as Broad bends). MFL
// coords pinned to the Market Street centerline (lat ~ 39.9528) for the
// underground section, then up Front Street, then Kensington/Frankford Avenues
// for the Frankford Elevated. Trolley/NHSL coords from the SEPTA system map.

import { type Line, type Mode, lookupLine } from "./lines";

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lineIds: string[];
  apiNames: string[];
}

const stations: Station[] = [
  // ===========================================================================
  // CENTER CITY REGIONAL RAIL HUB
  // ===========================================================================
  { id: "30th-st", name: "30th Street Station", lat: 39.9558, lon: -75.1820,
    lineIds: ["AIR","CHE","CHW","CYN","LAN","MED","NOR","PAO","TRE","WAR","WTR","WIL","FXC"],
    apiNames: ["30th Street Station","Gray 30th Street","Gray 30Th Street"] },
  { id: "suburban", name: "Suburban Station", lat: 39.9540, lon: -75.1684,
    lineIds: ["AIR","CHE","CHW","CYN","LAN","MED","NOR","PAO","TRE","WAR","WTR","WIL","FXC"],
    apiNames: ["Suburban Station"] },
  { id: "jefferson", name: "Jefferson Station", lat: 39.9528, lon: -75.1577,
    lineIds: ["AIR","CHE","CHW","CYN","LAN","MED","NOR","PAO","TRE","WAR","WTR","WIL","FXC"],
    apiNames: ["Jefferson Station","Market East"] },
  { id: "temple-u", name: "Temple University", lat: 39.9819, lon: -75.1517,
    lineIds: ["CHE","CHW","CYN","LAN","NOR","PAO","TRE","WAR","WTR","FXC","WIL","MED","AIR"],
    apiNames: ["Temple U","Temple University"] },
  { id: "penn-med", name: "Penn Medicine Station", lat: 39.9444, lon: -75.1936,
    lineIds: ["AIR","MED","PAO","WIL"],
    apiNames: ["Penn Medicine Station","Penn Medical Station","University City"] },
  { id: "north-philly", name: "North Philadelphia", lat: 39.9963, lon: -75.1577,
    lineIds: ["TRE","CHE","LAN"],
    apiNames: ["North Philadelphia","N Philadelphia"] },
  { id: "wayne-jct", name: "Wayne Junction", lat: 40.0224, lon: -75.1582,
    lineIds: ["CHE","FXC","LAN","NOR","WAR","WTR"],
    apiNames: ["Wayne Junction","Wayne Jct"] },

  // ===========================================================================
  // REGIONAL RAIL LINES
  // ===========================================================================
  // Airport
  { id: "airport-a",  name: "Airport Terminal A",   lat: 39.8742, lon: -75.2417, lineIds: ["AIR"], apiNames: ["Airport Terminal A"] },
  { id: "airport-b",  name: "Airport Terminal B",   lat: 39.8770, lon: -75.2425, lineIds: ["AIR"], apiNames: ["Airport Terminal B"] },
  { id: "airport-cd", name: "Airport Terminal C-D", lat: 39.8788, lon: -75.2407, lineIds: ["AIR"], apiNames: ["Airport Terminal C-D","Airport Terminal CD"] },
  { id: "airport-ef", name: "Airport Terminal E-F", lat: 39.8800, lon: -75.2378, lineIds: ["AIR"], apiNames: ["Airport Terminal E-F","Airport Terminal EF"] },
  { id: "eastwick",   name: "Eastwick",             lat: 39.8932, lon: -75.2256, lineIds: ["AIR"], apiNames: ["Eastwick"] },

  // Wilmington/Newark
  { id: "newark-de",   name: "Newark",       lat: 39.6792, lon: -75.7551, lineIds: ["WIL"], apiNames: ["Newark"] },
  { id: "wilmington",  name: "Wilmington",   lat: 39.7374, lon: -75.5510, lineIds: ["WIL"], apiNames: ["Wilmington"] },
  { id: "marcus-hook", name: "Marcus Hook",  lat: 39.8211, lon: -75.4196, lineIds: ["WIL"], apiNames: ["Marcus Hook"] },
  { id: "chester-tc",  name: "Chester TC",   lat: 39.8478, lon: -75.3565, lineIds: ["WIL"], apiNames: ["Chester TC","Chester"] },
  { id: "crum-lynne",  name: "Crum Lynne",   lat: 39.8676, lon: -75.3296, lineIds: ["WIL"], apiNames: ["Crum Lynne"] },
  { id: "ridley-park", name: "Ridley Park",  lat: 39.8810, lon: -75.3220, lineIds: ["WIL"], apiNames: ["Ridley Park"] },

  // Media/Wawa
  { id: "wawa",       name: "Wawa",        lat: 39.8826, lon: -75.4488, lineIds: ["MED"], apiNames: ["Wawa"] },
  { id: "media",      name: "Media",       lat: 39.9156, lon: -75.3911, lineIds: ["MED"], apiNames: ["Media"] },
  { id: "swarthmore", name: "Swarthmore",  lat: 39.9024, lon: -75.3505, lineIds: ["MED"], apiNames: ["Swarthmore"] },
  { id: "morton",     name: "Morton",      lat: 39.9092, lon: -75.3287, lineIds: ["MED"], apiNames: ["Morton"] },

  // Paoli/Thorndale
  { id: "thorndale",   name: "Thorndale",   lat: 40.0010, lon: -75.7595, lineIds: ["PAO"], apiNames: ["Thorndale"] },
  { id: "downingtown", name: "Downingtown", lat: 40.0093, lon: -75.7032, lineIds: ["PAO"], apiNames: ["Downingtown"] },
  { id: "exton",       name: "Exton",       lat: 40.0265, lon: -75.6249, lineIds: ["PAO"], apiNames: ["Exton"] },
  { id: "malvern",     name: "Malvern",     lat: 40.0357, lon: -75.5141, lineIds: ["PAO"], apiNames: ["Malvern"] },
  { id: "paoli",       name: "Paoli",       lat: 40.0432, lon: -75.4836, lineIds: ["PAO"], apiNames: ["Paoli"] },
  { id: "bryn-mawr",   name: "Bryn Mawr",   lat: 40.0193, lon: -75.3151, lineIds: ["PAO"], apiNames: ["Bryn Mawr"] },
  { id: "ardmore",     name: "Ardmore",     lat: 40.0040, lon: -75.2887, lineIds: ["PAO"], apiNames: ["Ardmore"] },
  { id: "haverford",   name: "Haverford",   lat: 40.0117, lon: -75.2962, lineIds: ["PAO"], apiNames: ["Haverford"] },
  { id: "overbrook",   name: "Overbrook",   lat: 39.9849, lon: -75.2511, lineIds: ["PAO"], apiNames: ["Overbrook"] },

  // Trenton
  { id: "trenton",            name: "Trenton",           lat: 40.2174, lon: -74.7600, lineIds: ["TRE"], apiNames: ["Trenton"] },
  { id: "levittown",          name: "Levittown",         lat: 40.1404, lon: -74.8189, lineIds: ["TRE"], apiNames: ["Levittown"] },
  { id: "bristol",            name: "Bristol",           lat: 40.1014, lon: -74.8541, lineIds: ["TRE"], apiNames: ["Bristol"] },
  { id: "croydon",            name: "Croydon",           lat: 40.0931, lon: -74.9036, lineIds: ["TRE"], apiNames: ["Croydon"] },
  { id: "cornwells-heights",  name: "Cornwells Heights", lat: 40.0708, lon: -74.9476, lineIds: ["TRE"], apiNames: ["Cornwells Heights"] },
  { id: "torresdale",         name: "Torresdale",        lat: 40.0512, lon: -74.9858, lineIds: ["TRE"], apiNames: ["Torresdale"] },

  // West Trenton
  { id: "west-trenton", name: "West Trenton", lat: 40.2599, lon: -74.8174, lineIds: ["WTR"], apiNames: ["West Trenton","W Trenton"] },
  { id: "yardley",      name: "Yardley",      lat: 40.2418, lon: -74.8456, lineIds: ["WTR"], apiNames: ["Yardley"] },
  { id: "langhorne",    name: "Langhorne",    lat: 40.1731, lon: -74.9197, lineIds: ["WTR"], apiNames: ["Langhorne"] },
  { id: "trevose",      name: "Trevose",      lat: 40.1442, lon: -74.9888, lineIds: ["WTR"], apiNames: ["Trevose"] },
  { id: "bethayres",    name: "Bethayres",    lat: 40.1018, lon: -75.0573, lineIds: ["WTR"], apiNames: ["Bethayres"] },
  { id: "jenkintown",   name: "Jenkintown-Wyncote", lat: 40.0945, lon: -75.1316, lineIds: ["WTR","LAN","WAR"], apiNames: ["Jenkintown-Wyncote","Jenkintown"] },

  // Warminster
  { id: "warminster",   name: "Warminster",   lat: 40.1928, lon: -75.0922, lineIds: ["WAR"], apiNames: ["Warminster"] },
  { id: "hatboro",      name: "Hatboro",      lat: 40.1761, lon: -75.1067, lineIds: ["WAR"], apiNames: ["Hatboro"] },
  { id: "willow-grove", name: "Willow Grove", lat: 40.1497, lon: -75.1167, lineIds: ["WAR"], apiNames: ["Willow Grove"] },

  // Lansdale/Doylestown
  { id: "doylestown",      name: "Doylestown",      lat: 40.3094, lon: -75.1296, lineIds: ["LAN"], apiNames: ["Doylestown"] },
  { id: "lansdale",        name: "Lansdale",        lat: 40.2412, lon: -75.2843, lineIds: ["LAN"], apiNames: ["Lansdale"] },
  { id: "north-wales",     name: "North Wales",     lat: 40.2113, lon: -75.2773, lineIds: ["LAN"], apiNames: ["North Wales"] },
  { id: "ambler",          name: "Ambler",          lat: 40.1546, lon: -75.2222, lineIds: ["LAN"], apiNames: ["Ambler"] },
  { id: "fort-washington", name: "Fort Washington", lat: 40.1410, lon: -75.2087, lineIds: ["LAN"], apiNames: ["Fort Washington"] },

  // Manayunk/Norristown
  { id: "norristown-tc", name: "Norristown TC", lat: 40.1158, lon: -75.3450, lineIds: ["NOR"], apiNames: ["Norristown TC","Norristown"] },
  { id: "conshohocken",  name: "Conshohocken",  lat: 40.0728, lon: -75.3083, lineIds: ["NOR"], apiNames: ["Conshohocken"] },
  { id: "manayunk",      name: "Manayunk",      lat: 40.0269, lon: -75.2079, lineIds: ["NOR"], apiNames: ["Manayunk"] },

  // Chestnut Hill East
  { id: "chestnut-hill-east", name: "Chestnut Hill East", lat: 40.0727, lon: -75.1928, lineIds: ["CHE"], apiNames: ["Chestnut Hill East","Chestnut Hl East","Chestnut H East"] },
  { id: "mount-airy",         name: "Mount Airy",         lat: 40.0610, lon: -75.1862, lineIds: ["CHE"], apiNames: ["Mount Airy"] },

  // Chestnut Hill West
  { id: "chestnut-hill-west", name: "Chestnut Hill West", lat: 40.0732, lon: -75.2052, lineIds: ["CHW"], apiNames: ["Chestnut Hill West","Chestnut Hl West","Chestnut H West"] },
  { id: "st-martins",         name: "St. Martins",        lat: 40.0658, lon: -75.2122, lineIds: ["CHW"], apiNames: ["St. Martins","St Martins"] },

  // Cynwyd
  { id: "cynwyd", name: "Cynwyd", lat: 39.9999, lon: -75.2308, lineIds: ["CYN"], apiNames: ["Cynwyd"] },
  { id: "bala",   name: "Bala",   lat: 39.9890, lon: -75.2229, lineIds: ["CYN"], apiNames: ["Bala"] },

  // Fox Chase
  { id: "fox-chase", name: "Fox Chase", lat: 40.0807, lon: -75.0822, lineIds: ["FXC"], apiNames: ["Fox Chase"] },
  { id: "olney-rr",  name: "Olney",     lat: 40.0354, lon: -75.1297, lineIds: ["FXC"], apiNames: ["Olney"] },

  // ===========================================================================
  // BROAD STREET LINE (BSL) — accurately along Broad St (~lon -75.164)
  // ===========================================================================
  { id: "bsl-fern-rock",          name: "Fern Rock TC",             lat: 40.0395, lon: -75.1389, lineIds: ["BSL"], apiNames: ["Fern Rock TC","Fern Rock"] },
  { id: "bsl-olney",              name: "Olney TC",                 lat: 40.0338, lon: -75.1422, lineIds: ["BSL"], apiNames: ["Olney TC"] },
  { id: "bsl-logan",              name: "Logan",                    lat: 40.0228, lon: -75.1455, lineIds: ["BSL"], apiNames: ["Logan"] },
  { id: "bsl-wyoming",            name: "Wyoming",                  lat: 40.0172, lon: -75.1469, lineIds: ["BSL"], apiNames: ["Wyoming"] },
  { id: "bsl-erie",               name: "Erie",                     lat: 40.0079, lon: -75.1492, lineIds: ["BSL"], apiNames: ["Erie"] },
  { id: "bsl-allegheny",          name: "Allegheny (BSL)",          lat: 40.0001, lon: -75.1513, lineIds: ["BSL"], apiNames: ["Allegheny"] },
  { id: "bsl-north-philadelphia", name: "North Philadelphia (BSL)", lat: 39.9931, lon: -75.1531, lineIds: ["BSL"], apiNames: ["North Philadelphia"] },
  { id: "bsl-susquehanna",        name: "Susquehanna-Dauphin",      lat: 39.9858, lon: -75.1550, lineIds: ["BSL"], apiNames: ["Susquehanna-Dauphin"] },
  { id: "bsl-cecil-b-moore",      name: "Cecil B. Moore",           lat: 39.9805, lon: -75.1565, lineIds: ["BSL"], apiNames: ["Cecil B Moore","Cecil B. Moore"] },
  { id: "bsl-girard",             name: "Girard (BSL)",             lat: 39.9707, lon: -75.1591, lineIds: ["BSL","G"], apiNames: ["Girard"] },
  { id: "bsl-fairmount",          name: "Fairmount",                lat: 39.9663, lon: -75.1604, lineIds: ["BSL"], apiNames: ["Fairmount"] },
  { id: "bsl-spring-garden",      name: "Spring Garden (BSL)",      lat: 39.9620, lon: -75.1615, lineIds: ["BSL"], apiNames: ["Spring Garden"] },
  { id: "bsl-race-vine",          name: "Race-Vine",                lat: 39.9568, lon: -75.1629, lineIds: ["BSL"], apiNames: ["Race-Vine"] },
  { id: "bsl-city-hall",          name: "City Hall",                lat: 39.9530, lon: -75.1641, lineIds: ["BSL"], apiNames: ["City Hall"] },
  { id: "bsl-walnut-locust",      name: "Walnut-Locust",            lat: 39.9484, lon: -75.1648, lineIds: ["BSL"], apiNames: ["Walnut-Locust"] },
  { id: "bsl-lombard-south",      name: "Lombard-South",            lat: 39.9436, lon: -75.1656, lineIds: ["BSL"], apiNames: ["Lombard-South"] },
  { id: "bsl-ellsworth-fed",      name: "Ellsworth-Federal",        lat: 39.9367, lon: -75.1668, lineIds: ["BSL"], apiNames: ["Ellsworth-Federal"] },
  { id: "bsl-tasker-morris",      name: "Tasker-Morris",            lat: 39.9303, lon: -75.1680, lineIds: ["BSL"], apiNames: ["Tasker-Morris"] },
  { id: "bsl-snyder",             name: "Snyder",                   lat: 39.9239, lon: -75.1693, lineIds: ["BSL"], apiNames: ["Snyder"] },
  { id: "bsl-oregon",             name: "Oregon",                   lat: 39.9166, lon: -75.1707, lineIds: ["BSL"], apiNames: ["Oregon"] },
  { id: "bsl-att",                name: "NRG Station",              lat: 39.9077, lon: -75.1727, lineIds: ["BSL"], apiNames: ["NRG Station","AT&T Station","Pattison"] },

  // ===========================================================================
  // MARKET-FRANKFORD LINE (MFL) — Market St → Front St → Kensington/Frankford
  // ===========================================================================
  { id: "mfl-69th-st",           name: "69th Street TC",        lat: 39.9700, lon: -75.2553, lineIds: ["MFL","D1","D2"], apiNames: ["69th Street TC","69th Street","69 St"] },
  { id: "mfl-millbourne",        name: "Millbourne",            lat: 39.9683, lon: -75.2452, lineIds: ["MFL"], apiNames: ["Millbourne"] },
  { id: "mfl-63rd",              name: "63rd Street",           lat: 39.9648, lon: -75.2382, lineIds: ["MFL"], apiNames: ["63rd Street","63 St"] },
  { id: "mfl-60th",              name: "60th Street",           lat: 39.9613, lon: -75.2308, lineIds: ["MFL"], apiNames: ["60th Street","60 St"] },
  { id: "mfl-56th",              name: "56th Street",           lat: 39.9595, lon: -75.2236, lineIds: ["MFL"], apiNames: ["56th Street","56 St"] },
  { id: "mfl-52nd",              name: "52nd Street",           lat: 39.9578, lon: -75.2161, lineIds: ["MFL"], apiNames: ["52nd Street","52 St"] },
  { id: "mfl-46th",              name: "46th Street",           lat: 39.9555, lon: -75.2080, lineIds: ["MFL"], apiNames: ["46th Street","46 St"] },
  { id: "mfl-40th",              name: "40th Street (MFL)",     lat: 39.9540, lon: -75.1996, lineIds: ["MFL"], apiNames: ["40th Street","40 St"] },
  { id: "mfl-34th",              name: "34th Street (MFL)",     lat: 39.9533, lon: -75.1900, lineIds: ["MFL"], apiNames: ["34th Street","34 St"] },
  { id: "mfl-30th",              name: "30th Street (MFL)",     lat: 39.9528, lon: -75.1825, lineIds: ["MFL"], apiNames: ["30th Street","30 St"] },
  { id: "mfl-15th",              name: "15th Street",           lat: 39.9526, lon: -75.1648, lineIds: ["MFL"], apiNames: ["15th Street","15 St"] },
  { id: "mfl-13th",              name: "13th Street (MFL)",     lat: 39.9527, lon: -75.1604, lineIds: ["MFL"], apiNames: ["13th Street","13 St"] },
  { id: "mfl-11th",              name: "11th Street",           lat: 39.9527, lon: -75.1567, lineIds: ["MFL"], apiNames: ["11th Street","11 St"] },
  { id: "mfl-8th",               name: "8th Street",            lat: 39.9526, lon: -75.1520, lineIds: ["MFL"], apiNames: ["8th Street","8 St"] },
  { id: "mfl-5th",               name: "5th Street/Independence Hall", lat: 39.9528, lon: -75.1485, lineIds: ["MFL"], apiNames: ["5th Street/Independence Hall","5 St"] },
  { id: "mfl-2nd",               name: "2nd Street",            lat: 39.9528, lon: -75.1432, lineIds: ["MFL"], apiNames: ["2nd Street","2 St"] },
  { id: "mfl-spring-garden",     name: "Spring Garden (MFL)",   lat: 39.9587, lon: -75.1410, lineIds: ["MFL"], apiNames: ["Spring Garden"] },
  { id: "mfl-girard",            name: "Girard (MFL)",          lat: 39.9696, lon: -75.1364, lineIds: ["MFL","G"], apiNames: ["Girard"] },
  { id: "mfl-berks",             name: "Berks",                 lat: 39.9762, lon: -75.1329, lineIds: ["MFL"], apiNames: ["Berks"] },
  { id: "mfl-york-dauphin",      name: "York-Dauphin",          lat: 39.9812, lon: -75.1300, lineIds: ["MFL"], apiNames: ["York-Dauphin"] },
  { id: "mfl-huntingdon",        name: "Huntingdon",            lat: 39.9858, lon: -75.1264, lineIds: ["MFL"], apiNames: ["Huntingdon"] },
  { id: "mfl-somerset",          name: "Somerset",              lat: 39.9908, lon: -75.1230, lineIds: ["MFL"], apiNames: ["Somerset"] },
  { id: "mfl-allegheny",         name: "Allegheny (MFL)",       lat: 39.9962, lon: -75.1181, lineIds: ["MFL"], apiNames: ["Allegheny"] },
  { id: "mfl-tioga",             name: "Tioga",                 lat: 40.0010, lon: -75.1148, lineIds: ["MFL"], apiNames: ["Tioga"] },
  { id: "mfl-erie-torresdale",   name: "Erie-Torresdale",       lat: 40.0072, lon: -75.1097, lineIds: ["MFL"], apiNames: ["Erie-Torresdale"] },
  { id: "mfl-church",            name: "Church",                lat: 40.0143, lon: -75.1042, lineIds: ["MFL"], apiNames: ["Church"] },
  { id: "mfl-margaret-orthodox", name: "Margaret-Orthodox",     lat: 40.0209, lon: -75.0982, lineIds: ["MFL"], apiNames: ["Margaret-Orthodox"] },
  { id: "mfl-arrott",            name: "Arrott TC",             lat: 40.0270, lon: -75.0908, lineIds: ["MFL"], apiNames: ["Arrott TC"] },
  { id: "mfl-bridge-pratt",      name: "Frankford TC",          lat: 40.0328, lon: -75.0773, lineIds: ["MFL","G"], apiNames: ["Frankford TC","Bridge-Pratt"] },

  // ===========================================================================
  // NORRISTOWN HIGH SPEED LINE (NHSL / Metro M)
  // ===========================================================================
  { id: "nhsl-norristown",          name: "Norristown TC (NHSL)",      lat: 40.1170, lon: -75.3439, lineIds: ["NHSL"], apiNames: ["Norristown"] },
  { id: "nhsl-bridgeport",          name: "Bridgeport",                lat: 40.1086, lon: -75.3434, lineIds: ["NHSL"], apiNames: ["Bridgeport"] },
  { id: "nhsl-dekalb",              name: "DeKalb St",                 lat: 40.1062, lon: -75.3439, lineIds: ["NHSL"], apiNames: ["DeKalb St"] },
  { id: "nhsl-hughes-park",         name: "Hughes Park",               lat: 40.0941, lon: -75.3429, lineIds: ["NHSL"], apiNames: ["Hughes Park"] },
  { id: "nhsl-gulph-mills",         name: "Gulph Mills",               lat: 40.0772, lon: -75.3565, lineIds: ["NHSL"], apiNames: ["Gulph Mills"] },
  { id: "nhsl-matsonford",          name: "Matsonford",                lat: 40.0671, lon: -75.3550, lineIds: ["NHSL"], apiNames: ["Matsonford"] },
  { id: "nhsl-county-line",         name: "County Line",               lat: 40.0578, lon: -75.3543, lineIds: ["NHSL"], apiNames: ["County Line"] },
  { id: "nhsl-radnor",              name: "Radnor",                    lat: 40.0466, lon: -75.3590, lineIds: ["NHSL"], apiNames: ["Radnor"] },
  { id: "nhsl-villanova",           name: "Villanova",                 lat: 40.0376, lon: -75.3429, lineIds: ["NHSL"], apiNames: ["Villanova"] },
  { id: "nhsl-stadium-ithan",       name: "Stadium-Ithan Ave",         lat: 40.0297, lon: -75.3367, lineIds: ["NHSL"], apiNames: ["Stadium-Ithan Ave"] },
  { id: "nhsl-bryn-mawr",           name: "Bryn Mawr (NHSL)",          lat: 40.0218, lon: -75.3252, lineIds: ["NHSL"], apiNames: ["Bryn Mawr"] },
  { id: "nhsl-roberts-rd",          name: "Roberts Rd",                lat: 40.0140, lon: -75.3157, lineIds: ["NHSL"], apiNames: ["Roberts Rd"] },
  { id: "nhsl-haverford",           name: "Haverford (NHSL)",          lat: 40.0086, lon: -75.3079, lineIds: ["NHSL"], apiNames: ["Haverford"] },
  { id: "nhsl-ardmore-jct",         name: "Ardmore Junction",          lat: 40.0033, lon: -75.2964, lineIds: ["NHSL"], apiNames: ["Ardmore Junction"] },
  { id: "nhsl-wynnewood-rd",        name: "Wynnewood Rd",              lat: 39.9986, lon: -75.2876, lineIds: ["NHSL"], apiNames: ["Wynnewood Rd"] },
  { id: "nhsl-beechwood-brookline", name: "Beechwood-Brookline",       lat: 39.9947, lon: -75.2803, lineIds: ["NHSL"], apiNames: ["Beechwood-Brookline"] },
  { id: "nhsl-penfield",            name: "Penfield",                  lat: 39.9907, lon: -75.2731, lineIds: ["NHSL"], apiNames: ["Penfield"] },
  { id: "nhsl-parkview",            name: "Parkview",                  lat: 39.9847, lon: -75.2640, lineIds: ["NHSL"], apiNames: ["Parkview"] },
  { id: "nhsl-township-line",       name: "Township Line Rd",          lat: 39.9788, lon: -75.2604, lineIds: ["NHSL"], apiNames: ["Township Line Rd"] },
  { id: "nhsl-69th-st",             name: "69th Street TC (NHSL)",     lat: 39.9700, lon: -75.2563, lineIds: ["NHSL"], apiNames: ["69th Street TC"] },

  // ===========================================================================
  // SUBWAY-SURFACE TROLLEY TUNNEL (shared by T1-T5)
  // ===========================================================================
  { id: "t-jefferson", name: "Jefferson Stn (Trolley)", lat: 39.9530, lon: -75.1593, lineIds: ["T1","T2","T3","T4","T5"], apiNames: ["Jefferson Station","Jefferson"] },
  { id: "t-13th",      name: "13th St (Trolley)",      lat: 39.9525, lon: -75.1612, lineIds: ["T1","T2","T3","T4","T5"], apiNames: ["13th"] },
  { id: "t-15th",      name: "15th St (Trolley)",      lat: 39.9525, lon: -75.1660, lineIds: ["T1","T2","T3","T4","T5"], apiNames: ["15th"] },
  { id: "t-19th",      name: "19th St",                lat: 39.9525, lon: -75.1718, lineIds: ["T1","T2","T3","T4","T5"], apiNames: ["19th"] },
  { id: "t-22nd",      name: "22nd St",                lat: 39.9518, lon: -75.1770, lineIds: ["T1","T2","T3","T4","T5"], apiNames: ["22nd"] },
  { id: "t-30th",      name: "30th St (Trolley)",      lat: 39.9540, lon: -75.1830, lineIds: ["T1","T2","T3","T4","T5"], apiNames: ["30th"] },
  { id: "t-33rd",      name: "33rd St",                lat: 39.9528, lon: -75.1900, lineIds: ["T1","T2","T3","T4","T5"], apiNames: ["33rd"] },
  { id: "t-36th",      name: "36th St",                lat: 39.9530, lon: -75.1962, lineIds: ["T1","T2","T3","T4","T5"], apiNames: ["36th"] },
  { id: "t-37th",      name: "37th St",                lat: 39.9525, lon: -75.1978, lineIds: ["T1","T2","T3","T4","T5"], apiNames: ["37th"] },

  // T1 (Route 10) — Lancaster Ave to 63rd & Malvern
  { id: "t1-40th",         name: "40th & Lancaster",  lat: 39.9582, lon: -75.2030, lineIds: ["T1","G"], apiNames: ["40th-Lancaster"] },
  { id: "t1-malvern",      name: "Malvern Ave",       lat: 39.9742, lon: -75.2222, lineIds: ["T1"], apiNames: ["Malvern Ave"] },
  { id: "t1-63rd-malvern", name: "63rd & Malvern",    lat: 39.9818, lon: -75.2473, lineIds: ["T1"], apiNames: ["63rd-Malvern"] },

  // T2 (Route 11) — Woodland to Darby TC
  { id: "t2-40th-woodland", name: "40th & Woodland",  lat: 39.9495, lon: -75.2010, lineIds: ["T2","T3","T4","T5"], apiNames: ["40th-Woodland"] },
  { id: "t2-49th",          name: "49th & Woodland",  lat: 39.9418, lon: -75.2126, lineIds: ["T2"], apiNames: ["49th-Woodland"] },
  { id: "t2-darby",         name: "Darby TC",         lat: 39.9181, lon: -75.2598, lineIds: ["T2","T3"], apiNames: ["Darby TC"] },

  // T3 (Route 13) — Chester Ave to Yeadon/Darby
  { id: "t3-40th-chester", name: "40th & Chester",   lat: 39.9468, lon: -75.2020, lineIds: ["T3"], apiNames: ["40th-Chester"] },
  { id: "t3-49th-chester", name: "49th & Chester",   lat: 39.9395, lon: -75.2135, lineIds: ["T3"], apiNames: ["49th-Chester"] },
  { id: "t3-yeadon",       name: "Yeadon Loop",      lat: 39.9382, lon: -75.2532, lineIds: ["T3"], apiNames: ["Yeadon Loop"] },

  // T4 (Route 34) — Baltimore Ave to 61st
  { id: "t4-40th-baltimore", name: "40th & Baltimore", lat: 39.9479, lon: -75.2031, lineIds: ["T4"], apiNames: ["40th-Baltimore"] },
  { id: "t4-49th-baltimore", name: "49th & Baltimore", lat: 39.9446, lon: -75.2191, lineIds: ["T4"], apiNames: ["49th-Baltimore"] },
  { id: "t4-61st-baltimore", name: "61st & Baltimore", lat: 39.9438, lon: -75.2403, lineIds: ["T4"], apiNames: ["61st-Baltimore"] },

  // T5 (Route 36) — Elmwood Ave to Eastwick Loop
  { id: "t5-40th-woodland", name: "40th & Island (T5)", lat: 39.9492, lon: -75.2014, lineIds: ["T5"], apiNames: ["40th-Island"] },
  { id: "t5-49th-woodland", name: "Elmwood Carhouse",   lat: 39.9303, lon: -75.2098, lineIds: ["T5"], apiNames: ["Elmwood Carhouse"] },
  { id: "t5-eastwick-loop", name: "Eastwick Loop",      lat: 39.8949, lon: -75.2421, lineIds: ["T5"], apiNames: ["Eastwick Loop"] },

  // G (Route 15) — Girard Ave trolley (40th & Lancaster to Frankford TC)
  { id: "g-40th-lancaster",  name: "40th & Lancaster (G)", lat: 39.9582, lon: -75.2030, lineIds: ["G"], apiNames: ["40th-Lancaster"] },
  { id: "g-girard-college",  name: "Girard College",       lat: 39.9779, lon: -75.1714, lineIds: ["G"], apiNames: ["Girard College"] },
  { id: "g-22nd-girard",     name: "22nd & Girard",        lat: 39.9728, lon: -75.1772, lineIds: ["G"], apiNames: ["22nd-Girard"] },
  { id: "g-frankford-tc",    name: "Frankford TC (G)",     lat: 40.0328, lon: -75.0773, lineIds: ["G"], apiNames: ["Frankford TC"] },

  // D1/D2 — Suburban trolleys from 69th St
  { id: "d-drexel-hill",   name: "Drexel Hill Jct",  lat: 39.9499, lon: -75.2899, lineIds: ["D1","D2"], apiNames: ["Drexel Hill Junction"] },
  { id: "d-aldan",         name: "Aldan",            lat: 39.9170, lon: -75.2920, lineIds: ["D1"], apiNames: ["Aldan"] },
  { id: "d-springfield",   name: "Springfield Mall", lat: 39.9170, lon: -75.3389, lineIds: ["D1"], apiNames: ["Springfield Mall"] },
  { id: "d1-media",        name: "Media (D1)",       lat: 39.9176, lon: -75.3879, lineIds: ["D1"], apiNames: ["Media"] },
  { id: "d2-clifton-aldan", name: "Clifton-Aldan",    lat: 39.9209, lon: -75.2961, lineIds: ["D2"], apiNames: ["Clifton-Aldan"] },
  { id: "d2-sharon-hill",  name: "Sharon Hill",      lat: 39.9020, lon: -75.2746, lineIds: ["D2"], apiNames: ["Sharon Hill"] },
];

export { stations };

const byApiName = new Map<string, Station>();
const byId = new Map<string, Station>();
for (const s of stations) {
  byId.set(s.id, s);
  for (const n of s.apiNames) byApiName.set(n.toLowerCase(), s);
}

export function lookupStation(input: string | null | undefined): Station | null {
  if (!input) return null;
  return byApiName.get(input.trim().toLowerCase()) ?? byId.get(input) ?? null;
}

export function lookupStationById(id: string): Station | null {
  return byId.get(id) ?? null;
}

export function stationLines(s: Station): Line[] {
  return s.lineIds.map((id) => lookupLine(id)).filter((l): l is Line => l !== null);
}

export function stationModes(s: Station): Mode[] {
  const modes = new Set<Mode>();
  for (const id of s.lineIds) {
    const line = lookupLine(id);
    if (line) modes.add(line.mode);
  }
  return [...modes];
}

export function hasRegionalRail(s: Station): boolean {
  return stationModes(s).includes("rr");
}
