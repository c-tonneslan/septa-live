// Curated SEPTA station list with WGS-84 coordinates.
// Coordinates from the SEPTA GTFS stops feed (public domain) cross-referenced
// against OpenStreetMap. The `apiNames` array carries every spelling that
// appears in TrainView / Arrivals JSON for the same station, since the feeds
// disagree (Gray 30th Street vs 30th Street Station vs Penn Medicine Station
// for the same platforms).

import { type Line, lookupLine } from "./lines";

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lineIds: string[];
  apiNames: string[];
}

const stations: Station[] = [
  // Center City + 30th St hub (every regional rail line passes here)
  { id: "30th-st", name: "30th Street Station", lat: 39.9558, lon: -75.1820,
    lineIds: ["AIR","CHE","CHW","CYN","LAN","MED","NOR","PAO","TRE","WAR","WTR","WIL","FXC"],
    apiNames: ["30th Street Station", "Gray 30th Street", "Gray 30Th Street"] },
  { id: "suburban", name: "Suburban Station", lat: 39.9540, lon: -75.1684,
    lineIds: ["AIR","CHE","CHW","CYN","LAN","MED","NOR","PAO","TRE","WAR","WTR","WIL","FXC"],
    apiNames: ["Suburban Station"] },
  { id: "jefferson", name: "Jefferson Station", lat: 39.9528, lon: -75.1577,
    lineIds: ["AIR","CHE","CHW","CYN","LAN","MED","NOR","PAO","TRE","WAR","WTR","WIL","FXC"],
    apiNames: ["Jefferson Station", "Market East"] },
  { id: "temple-u", name: "Temple University", lat: 39.9819, lon: -75.1517,
    lineIds: ["CHE","CHW","CYN","LAN","NOR","PAO","TRE","WAR","WTR","FXC"],
    apiNames: ["Temple U", "Temple University"] },
  { id: "penn-med", name: "Penn Medicine Station", lat: 39.9444, lon: -75.1936,
    lineIds: ["AIR","MED","PAO","WIL"],
    apiNames: ["Penn Medicine Station", "Penn Medical Station", "University City"] },
  { id: "north-philly", name: "North Philadelphia", lat: 39.9963, lon: -75.1577,
    lineIds: ["TRE","CHE","LAN"],
    apiNames: ["North Philadelphia", "N Philadelphia"] },
  { id: "wayne-jct", name: "Wayne Junction", lat: 40.0224, lon: -75.1582,
    lineIds: ["CHE","FXC","LAN","NOR","WAR","WTR"],
    apiNames: ["Wayne Junction", "Wayne Jct"] },

  // Airport line
  { id: "airport-a", name: "Airport Terminal A", lat: 39.8742, lon: -75.2417,
    lineIds: ["AIR"], apiNames: ["Airport Terminal A"] },
  { id: "airport-b", name: "Airport Terminal B", lat: 39.8770, lon: -75.2425,
    lineIds: ["AIR"], apiNames: ["Airport Terminal B"] },
  { id: "airport-cd", name: "Airport Terminal C-D", lat: 39.8788, lon: -75.2407,
    lineIds: ["AIR"], apiNames: ["Airport Terminal C-D", "Airport Terminal CD"] },
  { id: "airport-ef", name: "Airport Terminal E-F", lat: 39.8800, lon: -75.2378,
    lineIds: ["AIR"], apiNames: ["Airport Terminal E-F", "Airport Terminal EF"] },
  { id: "eastwick", name: "Eastwick", lat: 39.8932, lon: -75.2256,
    lineIds: ["AIR"], apiNames: ["Eastwick"] },

  // Wilmington/Newark
  { id: "newark-de", name: "Newark", lat: 39.6792, lon: -75.7551,
    lineIds: ["WIL"], apiNames: ["Newark"] },
  { id: "wilmington", name: "Wilmington", lat: 39.7374, lon: -75.5510,
    lineIds: ["WIL"], apiNames: ["Wilmington"] },
  { id: "marcus-hook", name: "Marcus Hook", lat: 39.8211, lon: -75.4196,
    lineIds: ["WIL"], apiNames: ["Marcus Hook"] },
  { id: "chester-tc", name: "Chester TC", lat: 39.8478, lon: -75.3565,
    lineIds: ["WIL"], apiNames: ["Chester TC", "Chester"] },
  { id: "crum-lynne", name: "Crum Lynne", lat: 39.8676, lon: -75.3296,
    lineIds: ["WIL"], apiNames: ["Crum Lynne"] },
  { id: "ridley-park", name: "Ridley Park", lat: 39.8810, lon: -75.3220,
    lineIds: ["WIL"], apiNames: ["Ridley Park"] },

  // Media/Wawa
  { id: "wawa", name: "Wawa", lat: 39.8826, lon: -75.4488,
    lineIds: ["MED"], apiNames: ["Wawa"] },
  { id: "media", name: "Media", lat: 39.9156, lon: -75.3911,
    lineIds: ["MED"], apiNames: ["Media"] },
  { id: "swarthmore", name: "Swarthmore", lat: 39.9024, lon: -75.3505,
    lineIds: ["MED"], apiNames: ["Swarthmore"] },
  { id: "morton", name: "Morton", lat: 39.9092, lon: -75.3287,
    lineIds: ["MED"], apiNames: ["Morton"] },

  // Paoli/Thorndale
  { id: "thorndale", name: "Thorndale", lat: 40.0010, lon: -75.7595,
    lineIds: ["PAO"], apiNames: ["Thorndale"] },
  { id: "downingtown", name: "Downingtown", lat: 40.0093, lon: -75.7032,
    lineIds: ["PAO"], apiNames: ["Downingtown"] },
  { id: "exton", name: "Exton", lat: 40.0265, lon: -75.6249,
    lineIds: ["PAO"], apiNames: ["Exton"] },
  { id: "malvern", name: "Malvern", lat: 40.0357, lon: -75.5141,
    lineIds: ["PAO"], apiNames: ["Malvern"] },
  { id: "paoli", name: "Paoli", lat: 40.0432, lon: -75.4836,
    lineIds: ["PAO"], apiNames: ["Paoli"] },
  { id: "bryn-mawr", name: "Bryn Mawr", lat: 40.0193, lon: -75.3151,
    lineIds: ["PAO"], apiNames: ["Bryn Mawr"] },
  { id: "ardmore", name: "Ardmore", lat: 40.0040, lon: -75.2887,
    lineIds: ["PAO"], apiNames: ["Ardmore"] },
  { id: "overbrook", name: "Overbrook", lat: 39.9849, lon: -75.2511,
    lineIds: ["PAO"], apiNames: ["Overbrook"] },
  { id: "haverford", name: "Haverford", lat: 40.0117, lon: -75.2962,
    lineIds: ["PAO"], apiNames: ["Haverford"] },

  // Trenton
  { id: "trenton", name: "Trenton", lat: 40.2174, lon: -74.7600,
    lineIds: ["TRE"], apiNames: ["Trenton"] },
  { id: "levittown", name: "Levittown", lat: 40.1404, lon: -74.8189,
    lineIds: ["TRE"], apiNames: ["Levittown"] },
  { id: "bristol", name: "Bristol", lat: 40.1014, lon: -74.8541,
    lineIds: ["TRE"], apiNames: ["Bristol"] },
  { id: "croydon", name: "Croydon", lat: 40.0931, lon: -74.9036,
    lineIds: ["TRE"], apiNames: ["Croydon"] },
  { id: "cornwells-heights", name: "Cornwells Heights", lat: 40.0708, lon: -74.9476,
    lineIds: ["TRE"], apiNames: ["Cornwells Heights"] },
  { id: "torresdale", name: "Torresdale", lat: 40.0512, lon: -74.9858,
    lineIds: ["TRE"], apiNames: ["Torresdale"] },

  // West Trenton
  { id: "west-trenton", name: "West Trenton", lat: 40.2599, lon: -74.8174,
    lineIds: ["WTR"], apiNames: ["West Trenton", "W Trenton"] },
  { id: "yardley", name: "Yardley", lat: 40.2418, lon: -74.8456,
    lineIds: ["WTR"], apiNames: ["Yardley"] },
  { id: "langhorne", name: "Langhorne", lat: 40.1731, lon: -74.9197,
    lineIds: ["WTR"], apiNames: ["Langhorne"] },
  { id: "trevose", name: "Trevose", lat: 40.1442, lon: -74.9888,
    lineIds: ["WTR"], apiNames: ["Trevose"] },
  { id: "bethayres", name: "Bethayres", lat: 40.1018, lon: -75.0573,
    lineIds: ["WTR"], apiNames: ["Bethayres"] },
  { id: "jenkintown", name: "Jenkintown-Wyncote", lat: 40.0945, lon: -75.1316,
    lineIds: ["WTR","LAN","WAR"], apiNames: ["Jenkintown-Wyncote", "Jenkintown"] },

  // Warminster
  { id: "warminster", name: "Warminster", lat: 40.1928, lon: -75.0922,
    lineIds: ["WAR"], apiNames: ["Warminster"] },
  { id: "hatboro", name: "Hatboro", lat: 40.1761, lon: -75.1067,
    lineIds: ["WAR"], apiNames: ["Hatboro"] },
  { id: "willow-grove", name: "Willow Grove", lat: 40.1497, lon: -75.1167,
    lineIds: ["WAR"], apiNames: ["Willow Grove"] },

  // Lansdale/Doylestown
  { id: "doylestown", name: "Doylestown", lat: 40.3094, lon: -75.1296,
    lineIds: ["LAN"], apiNames: ["Doylestown"] },
  { id: "lansdale", name: "Lansdale", lat: 40.2412, lon: -75.2843,
    lineIds: ["LAN"], apiNames: ["Lansdale"] },
  { id: "north-wales", name: "North Wales", lat: 40.2113, lon: -75.2773,
    lineIds: ["LAN"], apiNames: ["North Wales"] },
  { id: "ambler", name: "Ambler", lat: 40.1546, lon: -75.2222,
    lineIds: ["LAN"], apiNames: ["Ambler"] },
  { id: "fort-washington", name: "Fort Washington", lat: 40.1410, lon: -75.2087,
    lineIds: ["LAN"], apiNames: ["Fort Washington"] },

  // Manayunk/Norristown
  { id: "norristown-tc", name: "Norristown TC", lat: 40.1158, lon: -75.3450,
    lineIds: ["NOR"], apiNames: ["Norristown TC", "Norristown"] },
  { id: "conshohocken", name: "Conshohocken", lat: 40.0728, lon: -75.3083,
    lineIds: ["NOR"], apiNames: ["Conshohocken"] },
  { id: "manayunk", name: "Manayunk", lat: 40.0269, lon: -75.2079,
    lineIds: ["NOR"], apiNames: ["Manayunk"] },

  // Chestnut Hill East
  { id: "chestnut-hill-east", name: "Chestnut Hill East", lat: 40.0727, lon: -75.1928,
    lineIds: ["CHE"], apiNames: ["Chestnut Hill East", "Chestnut Hl East", "Chestnut H East"] },
  { id: "mount-airy", name: "Mount Airy", lat: 40.0610, lon: -75.1862,
    lineIds: ["CHE"], apiNames: ["Mount Airy"] },

  // Chestnut Hill West
  { id: "chestnut-hill-west", name: "Chestnut Hill West", lat: 40.0732, lon: -75.2052,
    lineIds: ["CHW"], apiNames: ["Chestnut Hill West", "Chestnut Hl West", "Chestnut H West"] },
  { id: "st-martins", name: "St. Martins", lat: 40.0658, lon: -75.2122,
    lineIds: ["CHW"], apiNames: ["St. Martins", "St Martins"] },

  // Cynwyd
  { id: "cynwyd", name: "Cynwyd", lat: 39.9999, lon: -75.2308,
    lineIds: ["CYN"], apiNames: ["Cynwyd"] },
  { id: "bala", name: "Bala", lat: 39.9890, lon: -75.2229,
    lineIds: ["CYN"], apiNames: ["Bala"] },

  // Fox Chase
  { id: "fox-chase", name: "Fox Chase", lat: 40.0807, lon: -75.0822,
    lineIds: ["FXC"], apiNames: ["Fox Chase"] },
  { id: "olney-rr", name: "Olney", lat: 40.0354, lon: -75.1297,
    lineIds: ["FXC"], apiNames: ["Olney"] },

  // Broad Street Line (BSL)
  { id: "bsl-fern-rock", name: "Fern Rock TC", lat: 40.0395, lon: -75.1346,
    lineIds: ["BSL"], apiNames: ["Fern Rock TC"] },
  { id: "bsl-olney", name: "Olney TC", lat: 40.0337, lon: -75.1426,
    lineIds: ["BSL"], apiNames: ["Olney TC"] },
  { id: "bsl-logan", name: "Logan", lat: 40.0233, lon: -75.1442,
    lineIds: ["BSL"], apiNames: ["Logan"] },
  { id: "bsl-wyoming", name: "Wyoming", lat: 40.0181, lon: -75.1467,
    lineIds: ["BSL"], apiNames: ["Wyoming"] },
  { id: "bsl-erie", name: "Erie", lat: 40.0027, lon: -75.1505,
    lineIds: ["BSL"], apiNames: ["Erie"] },
  { id: "bsl-allegheny", name: "Allegheny", lat: 39.9920, lon: -75.1525,
    lineIds: ["BSL"], apiNames: ["Allegheny"] },
  { id: "bsl-north-philadelphia", name: "North Philadelphia (BSL)", lat: 39.9836, lon: -75.1543,
    lineIds: ["BSL"], apiNames: ["North Philadelphia"] },
  { id: "bsl-susquehanna", name: "Susquehanna-Dauphin", lat: 39.9776, lon: -75.1558,
    lineIds: ["BSL"], apiNames: ["Susquehanna-Dauphin"] },
  { id: "bsl-cecil-b-moore", name: "Cecil B. Moore", lat: 39.9789, lon: -75.1577,
    lineIds: ["BSL"], apiNames: ["Cecil B Moore", "Cecil B. Moore"] },
  { id: "bsl-girard", name: "Girard", lat: 39.9706, lon: -75.1583,
    lineIds: ["BSL"], apiNames: ["Girard"] },
  { id: "bsl-fairmount", name: "Fairmount", lat: 39.9665, lon: -75.1590,
    lineIds: ["BSL"], apiNames: ["Fairmount"] },
  { id: "bsl-spring-garden", name: "Spring Garden", lat: 39.9618, lon: -75.1614,
    lineIds: ["BSL"], apiNames: ["Spring Garden"] },
  { id: "bsl-race-vine", name: "Race-Vine", lat: 39.9573, lon: -75.1620,
    lineIds: ["BSL"], apiNames: ["Race-Vine"] },
  { id: "bsl-city-hall", name: "City Hall", lat: 39.9530, lon: -75.1635,
    lineIds: ["BSL"], apiNames: ["City Hall"] },
  { id: "bsl-walnut-locust", name: "Walnut-Locust", lat: 39.9485, lon: -75.1660,
    lineIds: ["BSL"], apiNames: ["Walnut-Locust"] },
  { id: "bsl-lombard-south", name: "Lombard-South", lat: 39.9430, lon: -75.1680,
    lineIds: ["BSL"], apiNames: ["Lombard-South"] },
  { id: "bsl-ellsworth-fed", name: "Ellsworth-Federal", lat: 39.9366, lon: -75.1707,
    lineIds: ["BSL"], apiNames: ["Ellsworth-Federal"] },
  { id: "bsl-tasker-morris", name: "Tasker-Morris", lat: 39.9296, lon: -75.1731,
    lineIds: ["BSL"], apiNames: ["Tasker-Morris"] },
  { id: "bsl-snyder", name: "Snyder", lat: 39.9237, lon: -75.1755,
    lineIds: ["BSL"], apiNames: ["Snyder"] },
  { id: "bsl-oregon", name: "Oregon", lat: 39.9163, lon: -75.1778,
    lineIds: ["BSL"], apiNames: ["Oregon"] },
  { id: "bsl-att", name: "NRG Station", lat: 39.9069, lon: -75.1812,
    lineIds: ["BSL"], apiNames: ["NRG Station", "AT&T Station", "Pattison"] },

  // Market-Frankford Line (MFL)
  { id: "mfl-69th-st", name: "69th Street TC", lat: 39.9706, lon: -75.2554,
    lineIds: ["MFL"], apiNames: ["69th Street TC", "69th Street", "69 St"] },
  { id: "mfl-millbourne", name: "Millbourne", lat: 39.9669, lon: -75.2462,
    lineIds: ["MFL"], apiNames: ["Millbourne"] },
  { id: "mfl-63rd", name: "63rd Street", lat: 39.9648, lon: -75.2367,
    lineIds: ["MFL"], apiNames: ["63rd Street", "63 St"] },
  { id: "mfl-60th", name: "60th Street", lat: 39.9613, lon: -75.2275,
    lineIds: ["MFL"], apiNames: ["60th Street", "60 St"] },
  { id: "mfl-56th", name: "56th Street", lat: 39.9596, lon: -75.2196,
    lineIds: ["MFL"], apiNames: ["56th Street", "56 St"] },
  { id: "mfl-52nd", name: "52nd Street", lat: 39.9580, lon: -75.2121,
    lineIds: ["MFL"], apiNames: ["52nd Street", "52 St"] },
  { id: "mfl-46th", name: "46th Street", lat: 39.9559, lon: -75.2017,
    lineIds: ["MFL"], apiNames: ["46th Street", "46 St"] },
  { id: "mfl-40th", name: "40th Street", lat: 39.9544, lon: -75.2007,
    lineIds: ["MFL"], apiNames: ["40th Street", "40 St"] },
  { id: "mfl-34th", name: "34th Street", lat: 39.9543, lon: -75.1899,
    lineIds: ["MFL"], apiNames: ["34th Street", "34 St"] },
  { id: "mfl-30th", name: "30th Street (MFL)", lat: 39.9548, lon: -75.1827,
    lineIds: ["MFL"], apiNames: ["30th Street", "30 St"] },
  { id: "mfl-15th", name: "15th Street", lat: 39.9528, lon: -75.1648,
    lineIds: ["MFL"], apiNames: ["15th Street", "15 St"] },
  { id: "mfl-13th", name: "13th Street", lat: 39.9522, lon: -75.1612,
    lineIds: ["MFL"], apiNames: ["13th Street", "13 St"] },
  { id: "mfl-11th", name: "11th Street", lat: 39.9518, lon: -75.1568,
    lineIds: ["MFL"], apiNames: ["11th Street", "11 St"] },
  { id: "mfl-8th", name: "8th Street", lat: 39.9513, lon: -75.1521,
    lineIds: ["MFL"], apiNames: ["8th Street", "8 St"] },
  { id: "mfl-5th", name: "5th Street/Independence Hall", lat: 39.9506, lon: -75.1486,
    lineIds: ["MFL"], apiNames: ["5th Street/Independence Hall", "5 St"] },
  { id: "mfl-2nd", name: "2nd Street", lat: 39.9499, lon: -75.1437,
    lineIds: ["MFL"], apiNames: ["2nd Street", "2 St"] },
  { id: "mfl-spring-garden", name: "Spring Garden (MFL)", lat: 39.9583, lon: -75.1402,
    lineIds: ["MFL"], apiNames: ["Spring Garden"] },
  { id: "mfl-girard", name: "Girard (MFL)", lat: 39.9686, lon: -75.1336,
    lineIds: ["MFL"], apiNames: ["Girard"] },
  { id: "mfl-berks", name: "Berks", lat: 39.9758, lon: -75.1295,
    lineIds: ["MFL"], apiNames: ["Berks"] },
  { id: "mfl-york-dauphin", name: "York-Dauphin", lat: 39.9810, lon: -75.1258,
    lineIds: ["MFL"], apiNames: ["York-Dauphin"] },
  { id: "mfl-huntingdon", name: "Huntingdon", lat: 39.9858, lon: -75.1221,
    lineIds: ["MFL"], apiNames: ["Huntingdon"] },
  { id: "mfl-somerset", name: "Somerset", lat: 39.9902, lon: -75.1175,
    lineIds: ["MFL"], apiNames: ["Somerset"] },
  { id: "mfl-allegheny", name: "Allegheny (MFL)", lat: 39.9947, lon: -75.1142,
    lineIds: ["MFL"], apiNames: ["Allegheny"] },
  { id: "mfl-tioga", name: "Tioga", lat: 40.0013, lon: -75.1088,
    lineIds: ["MFL"], apiNames: ["Tioga"] },
  { id: "mfl-erie-torresdale", name: "Erie-Torresdale", lat: 40.0077, lon: -75.1032,
    lineIds: ["MFL"], apiNames: ["Erie-Torresdale"] },
  { id: "mfl-church", name: "Church", lat: 40.0151, lon: -75.0975,
    lineIds: ["MFL"], apiNames: ["Church"] },
  { id: "mfl-margaret-orthodox", name: "Margaret-Orthodox", lat: 40.0212, lon: -75.0917,
    lineIds: ["MFL"], apiNames: ["Margaret-Orthodox"] },
  { id: "mfl-arrott", name: "Arrott TC", lat: 40.0276, lon: -75.0860,
    lineIds: ["MFL"], apiNames: ["Arrott TC"] },
  { id: "mfl-bridge-pratt", name: "Frankford TC", lat: 40.0331, lon: -75.0773,
    lineIds: ["MFL"], apiNames: ["Frankford TC", "Bridge-Pratt"] },
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

export function stationLines(s: Station): Line[] {
  return s.lineIds.map((id) => lookupLine(id)).filter((l): l is Line => l !== null);
}
