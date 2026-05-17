// SEPTA line registry, using SEPTA Metro brand colors for the rapid-transit
// modes (B/L/M/T/G/D) and the published Regional Rail colors for the rest.
// The Metro letter system rolled out 2024-2025, but the agency's public APIs
// still mix old and new IDs (TransitViewAll returns "T2", Alerts uses "MFL",
// TrainView returns the long name "Trenton"). `apiNames` carries every
// spelling each feed uses so a lookup resolves to the same Line entry.

export type Mode = "rr" | "bsl" | "mfl" | "nhsl" | "trolley" | "girard" | "suburban-trolley";

export interface Line {
  id: string;
  metro?: string; // SEPTA Metro letter (L, B, M, T, G, D)
  name: string;
  short: string;
  mode: Mode;
  color: string;
  apiNames: string[];
  // Ordered station IDs for drawing a polyline between stops. Empty arrays
  // mean "don't draw a polyline for this line" (e.g. lines we haven't curated
  // a station ordering for yet).
  stationOrder: string[];
}

// SEPTA Metro palette (from the agency's 2024 brand guide, hex-matched
// against septa.org's CSS).
const C = {
  L_BLUE: "#0072B3",       // Market-Frankford
  B_ORANGE: "#F58025",     // Broad Street
  M_PURPLE: "#5A2D7F",     // Norristown High Speed
  T_GREEN: "#00A551",      // Subway-Surface trolleys
  G_YELLOW: "#F5C518",     // Girard
  D_TEAL: "#00A0B0",       // Suburban trolleys (Media/Sharon Hill)
};

export const lines: Line[] = [
  // --- Regional Rail (13 lines, SEPTA's published per-line colors) ---
  {
    id: "AIR", name: "Airport", short: "AIR", mode: "rr",
    color: "#1f8edb", apiNames: ["Airport"],
    stationOrder: [
      "airport-ef","airport-cd","airport-b","airport-a","eastwick",
      "penn-med","30th-st","suburban","jefferson","temple-u",
    ],
  },
  {
    id: "CHE", name: "Chestnut Hill East", short: "CHE", mode: "rr",
    color: "#7d6c46",
    apiNames: ["Chestnut Hill East", "Chestnut Hl East", "Chestnut H East"],
    stationOrder: [
      "chestnut-hill-east","mount-airy","wayne-jct","north-philly",
      "temple-u","jefferson","suburban","30th-st",
    ],
  },
  {
    id: "CHW", name: "Chestnut Hill West", short: "CHW", mode: "rr",
    color: "#b96f4a",
    apiNames: ["Chestnut Hill West", "Chestnut Hl West", "Chestnut H West"],
    stationOrder: [
      "chestnut-hill-west","st-martins","30th-st","suburban","jefferson","temple-u",
    ],
  },
  {
    id: "CYN", name: "Cynwyd", short: "CYN", mode: "rr",
    color: "#7a7a7a", apiNames: ["Cynwyd"],
    stationOrder: ["cynwyd","bala","30th-st","suburban","jefferson"],
  },
  {
    id: "FXC", name: "Fox Chase", short: "FXC", mode: "rr",
    color: "#dd3a86", apiNames: ["Fox Chase"],
    stationOrder: ["fox-chase","olney-rr","wayne-jct","temple-u","jefferson","suburban","30th-st"],
  },
  {
    id: "LAN", name: "Lansdale/Doylestown", short: "LAN", mode: "rr",
    color: "#e6b300", apiNames: ["Lansdale/Doylestown","Lansdale","Doylestown"],
    stationOrder: [
      "doylestown","lansdale","north-wales","ambler","fort-washington",
      "jenkintown","wayne-jct","north-philly","temple-u","jefferson","suburban","30th-st",
    ],
  },
  {
    id: "MED", name: "Media/Wawa", short: "MED", mode: "rr",
    color: "#8f1b2d",
    apiNames: ["Media/Wawa","Media/Elwyn","Wawa","Elwyn"],
    stationOrder: [
      "wawa","media","swarthmore","morton","penn-med","30th-st","suburban","jefferson","temple-u",
    ],
  },
  {
    id: "NOR", name: "Manayunk/Norristown", short: "NOR", mode: "rr",
    color: "#9b6d3c", apiNames: ["Manayunk/Norristown","Norristown"],
    stationOrder: [
      "norristown-tc","conshohocken","manayunk","wayne-jct","temple-u","jefferson","suburban","30th-st",
    ],
  },
  {
    id: "PAO", name: "Paoli/Thorndale", short: "PAO", mode: "rr",
    color: "#9933a5", apiNames: ["Paoli/Thorndale","Paoli","Thorndale"],
    stationOrder: [
      "thorndale","downingtown","exton","malvern","paoli",
      "bryn-mawr","haverford","ardmore","overbrook","penn-med","30th-st","suburban","jefferson","temple-u",
    ],
  },
  {
    id: "TRE", name: "Trenton", short: "TRE", mode: "rr",
    color: "#1b3e8f", apiNames: ["Trenton"],
    stationOrder: [
      "trenton","levittown","bristol","croydon","cornwells-heights","torresdale",
      "north-philly","temple-u","jefferson","suburban","30th-st",
    ],
  },
  {
    id: "WAR", name: "Warminster", short: "WAR", mode: "rr",
    color: "#df3d2d", apiNames: ["Warminster"],
    stationOrder: [
      "warminster","hatboro","willow-grove","jenkintown","wayne-jct","temple-u","jefferson","suburban","30th-st",
    ],
  },
  {
    id: "WTR", name: "West Trenton", short: "WTR", mode: "rr",
    color: "#0a8a3e", apiNames: ["West Trenton","W Trenton"],
    stationOrder: [
      "west-trenton","yardley","langhorne","trevose","bethayres","jenkintown","wayne-jct","temple-u","jefferson","suburban","30th-st",
    ],
  },
  {
    id: "WIL", name: "Wilmington/Newark", short: "WIL", mode: "rr",
    color: "#005ea8", apiNames: ["Wilmington/Newark","Wilmington","Newark"],
    stationOrder: [
      "newark-de","wilmington","marcus-hook","chester-tc","crum-lynne","ridley-park",
      "penn-med","30th-st","suburban","jefferson","temple-u",
    ],
  },

  // --- Rapid transit ---
  {
    id: "BSL", metro: "B", name: "Broad Street Line", short: "B", mode: "bsl",
    color: C.B_ORANGE,
    apiNames: ["Broad Street","BSL","B","Broad St","Broad Ridge Spur"],
    stationOrder: [
      "bsl-fern-rock","bsl-olney","bsl-logan","bsl-wyoming","bsl-erie","bsl-allegheny",
      "bsl-north-philadelphia","bsl-susquehanna","bsl-cecil-b-moore","bsl-girard","bsl-fairmount",
      "bsl-spring-garden","bsl-race-vine","bsl-city-hall","bsl-walnut-locust","bsl-lombard-south",
      "bsl-ellsworth-fed","bsl-tasker-morris","bsl-snyder","bsl-oregon","bsl-att",
    ],
  },
  {
    id: "MFL", metro: "L", name: "Market-Frankford Line", short: "L", mode: "mfl",
    color: C.L_BLUE,
    apiNames: ["Market-Frankford","MFL","L","Market Frankford","Market Street Elevated"],
    stationOrder: [
      "mfl-69th-st","mfl-millbourne","mfl-63rd","mfl-60th","mfl-56th","mfl-52nd","mfl-46th",
      "mfl-40th","mfl-34th","mfl-30th","mfl-15th","mfl-13th","mfl-11th","mfl-8th",
      "mfl-5th","mfl-2nd","mfl-spring-garden","mfl-girard","mfl-berks","mfl-york-dauphin",
      "mfl-huntingdon","mfl-somerset","mfl-allegheny","mfl-tioga","mfl-erie-torresdale",
      "mfl-church","mfl-margaret-orthodox","mfl-arrott","mfl-bridge-pratt",
    ],
  },
  {
    id: "NHSL", metro: "M", name: "Norristown High Speed Line", short: "M", mode: "nhsl",
    color: C.M_PURPLE,
    apiNames: ["Norristown High Speed","NHSL","M","Route 100"],
    stationOrder: [
      "nhsl-norristown","nhsl-bridgeport","nhsl-dekalb","nhsl-hughes-park","nhsl-gulph-mills",
      "nhsl-matsonford","nhsl-county-line","nhsl-radnor","nhsl-villanova","nhsl-stadium-ithan",
      "nhsl-bryn-mawr","nhsl-roberts-rd","nhsl-haverford","nhsl-ardmore-jct","nhsl-wynnewood-rd",
      "nhsl-beechwood-brookline","nhsl-penfield","nhsl-parkview","nhsl-township-line","nhsl-69th-st",
    ],
  },

  // --- Subway-surface trolleys (share Center City tunnel, branch in West Philly) ---
  {
    id: "T1", metro: "T1", name: "Route 10 — Lancaster Ave", short: "T1", mode: "trolley",
    color: C.T_GREEN,
    apiNames: ["10","T1","Route 10"],
    stationOrder: [
      "t-jefferson","t-13th","t-15th","t-19th","t-22nd","t-30th","t-33rd","t-36th","t-37th",
      "t1-40th","t1-malvern","t1-63rd-malvern",
    ],
  },
  {
    id: "T2", metro: "T2", name: "Route 11 — Woodland Ave", short: "T2", mode: "trolley",
    color: C.T_GREEN,
    apiNames: ["11","T2","Route 11"],
    stationOrder: [
      "t-jefferson","t-13th","t-15th","t-19th","t-22nd","t-30th","t-33rd","t-36th","t-37th",
      "t2-40th-woodland","t2-49th","t2-darby",
    ],
  },
  {
    id: "T3", metro: "T3", name: "Route 13 — Chester Ave", short: "T3", mode: "trolley",
    color: C.T_GREEN,
    apiNames: ["13","T3","Route 13"],
    stationOrder: [
      "t-jefferson","t-13th","t-15th","t-19th","t-22nd","t-30th","t-33rd","t-36th","t-37th",
      "t3-40th-chester","t3-49th-chester","t3-yeadon","t3-darby",
    ],
  },
  {
    id: "T4", metro: "T4", name: "Route 34 — Baltimore Ave", short: "T4", mode: "trolley",
    color: C.T_GREEN,
    apiNames: ["34","T4","Route 34"],
    stationOrder: [
      "t-jefferson","t-13th","t-15th","t-19th","t-22nd","t-30th","t-33rd","t-36th","t-37th",
      "t4-40th-baltimore","t4-49th-baltimore","t4-61st-baltimore",
    ],
  },
  {
    id: "T5", metro: "T5", name: "Route 36 — Elmwood/Eastwick", short: "T5", mode: "trolley",
    color: C.T_GREEN,
    apiNames: ["36","T5","Route 36"],
    stationOrder: [
      "t-jefferson","t-13th","t-15th","t-19th","t-22nd","t-30th","t-33rd","t-36th","t-37th",
      "t5-40th-woodland","t5-49th-woodland","t5-eastwick-loop",
    ],
  },
  {
    id: "G", metro: "G", name: "Route 15 — Girard Ave", short: "G", mode: "girard",
    color: C.G_YELLOW,
    apiNames: ["15","G","Route 15"],
    stationOrder: [
      "g-40th-lancaster","g-girard-college","g-22nd-girard","bsl-girard","mfl-girard","g-frankford-tc",
    ],
  },
  {
    id: "D1", metro: "D1", name: "Route 101 — Media", short: "D1", mode: "suburban-trolley",
    color: C.D_TEAL,
    apiNames: ["101","D1","Route 101"],
    stationOrder: [
      "mfl-69th-st","d-drexel-hill","d-aldan","d-springfield","d1-media",
    ],
  },
  {
    id: "D2", metro: "D2", name: "Route 102 — Sharon Hill", short: "D2", mode: "suburban-trolley",
    color: C.D_TEAL,
    apiNames: ["102","D2","Route 102"],
    stationOrder: [
      "mfl-69th-st","d-drexel-hill","d2-clifton-aldan","d2-sharon-hill",
    ],
  },
];

const byApiName = new Map<string, Line>();
const byId = new Map<string, Line>();

for (const line of lines) {
  byId.set(line.id, line);
  if (line.metro) byId.set(line.metro, line);
  for (const name of line.apiNames) {
    byApiName.set(name.toLowerCase(), line);
  }
}

export function lookupLine(input: string | null | undefined): Line | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  return byApiName.get(key) ?? byId.get(input.toUpperCase()) ?? byId.get(input) ?? null;
}

export function lineColor(input: string | null | undefined): string {
  return lookupLine(input)?.color ?? "#888888";
}
