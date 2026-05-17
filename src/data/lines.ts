// SEPTA line registry. Brand colors from the public SEPTA System Map (2023+).
// The `apiNames` array lists every spelling that shows up in the JSON feeds for
// that line (TrainView, Arrivals, NextToArrive don't all agree). Looking up by
// any of those resolves to the same Line entry.

export type Mode = "rr" | "subway" | "trolley" | "nhsl";

export interface Line {
  id: string;
  name: string;
  short: string;
  mode: Mode;
  color: string;
  apiNames: string[];
}

export const lines: Line[] = [
  {
    id: "AIR",
    name: "Airport",
    short: "AIR",
    mode: "rr",
    color: "#1f8edb",
    apiNames: ["Airport"],
  },
  {
    id: "CHE",
    name: "Chestnut Hill East",
    short: "CHE",
    mode: "rr",
    color: "#7d6c46",
    apiNames: ["Chestnut Hill East", "Chestnut Hl East", "Chestnut H East"],
  },
  {
    id: "CHW",
    name: "Chestnut Hill West",
    short: "CHW",
    mode: "rr",
    color: "#b96f4a",
    apiNames: ["Chestnut Hill West", "Chestnut Hl West", "Chestnut H West"],
  },
  {
    id: "CYN",
    name: "Cynwyd",
    short: "CYN",
    mode: "rr",
    color: "#b2b2b2",
    apiNames: ["Cynwyd"],
  },
  {
    id: "FXC",
    name: "Fox Chase",
    short: "FXC",
    mode: "rr",
    color: "#dd3a86",
    apiNames: ["Fox Chase"],
  },
  {
    id: "LAN",
    name: "Lansdale/Doylestown",
    short: "LAN",
    mode: "rr",
    color: "#e6b300",
    apiNames: ["Lansdale/Doylestown", "Lansdale", "Doylestown"],
  },
  {
    id: "MED",
    name: "Media/Wawa",
    short: "MED",
    mode: "rr",
    color: "#8f1b2d",
    apiNames: ["Media/Wawa", "Media/Elwyn", "Wawa", "Elwyn"],
  },
  {
    id: "NOR",
    name: "Manayunk/Norristown",
    short: "NOR",
    mode: "rr",
    color: "#9b6d3c",
    apiNames: ["Manayunk/Norristown", "Norristown"],
  },
  {
    id: "PAO",
    name: "Paoli/Thorndale",
    short: "PAO",
    mode: "rr",
    color: "#9933a5",
    apiNames: ["Paoli/Thorndale", "Paoli", "Thorndale"],
  },
  {
    id: "TRE",
    name: "Trenton",
    short: "TRE",
    mode: "rr",
    color: "#1b3e8f",
    apiNames: ["Trenton"],
  },
  {
    id: "WAR",
    name: "Warminster",
    short: "WAR",
    mode: "rr",
    color: "#df3d2d",
    apiNames: ["Warminster"],
  },
  {
    id: "WTR",
    name: "West Trenton",
    short: "WTR",
    mode: "rr",
    color: "#0a8a3e",
    apiNames: ["West Trenton", "W Trenton"],
  },
  {
    id: "WIL",
    name: "Wilmington/Newark",
    short: "WIL",
    mode: "rr",
    color: "#005ea8",
    apiNames: ["Wilmington/Newark", "Wilmington", "Newark"],
  },
  {
    id: "BSL",
    name: "Broad Street Line",
    short: "BSL",
    mode: "subway",
    color: "#ff7f00",
    apiNames: ["Broad Street", "BSL"],
  },
  {
    id: "MFL",
    name: "Market-Frankford Line",
    short: "MFL",
    mode: "subway",
    color: "#1565c0",
    apiNames: ["Market-Frankford", "MFL"],
  },
  {
    id: "NHSL",
    name: "Norristown High Speed Line",
    short: "NHSL",
    mode: "nhsl",
    color: "#7c3aed",
    apiNames: ["Norristown High Speed", "NHSL"],
  },
];

const byApiName = new Map<string, Line>();
const byId = new Map<string, Line>();

for (const line of lines) {
  byId.set(line.id, line);
  for (const name of line.apiNames) {
    byApiName.set(name.toLowerCase(), line);
  }
}

export function lookupLine(input: string | null | undefined): Line | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  return byApiName.get(key) ?? byId.get(input.toUpperCase()) ?? null;
}

export function lineColor(input: string | null | undefined): string {
  return lookupLine(input)?.color ?? "#888888";
}
