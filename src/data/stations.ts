// SEPTA station list. Every entry is auto-generated from the SEPTA GTFS
// stops feed (see scripts/gen-gtfs.py + src/data/generated.ts). For trolleys,
// every-block street stops are filtered out at generation time so they don't
// crowd the map; the route polylines still trace the real street geometry
// because they come from GTFS shapes.txt.

import { type Line, type Mode, lookupLine } from "./lines";
import { GENERATED_STATIONS } from "./generated";

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lineIds: string[];
  apiNames: string[];
}

export const stations: Station[] = GENERATED_STATIONS as Station[];

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
