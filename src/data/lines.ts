// SEPTA line registry. Coordinates, station ordering, and route polyline
// shapes are auto-generated from SEPTA's published GTFS feed (see
// scripts/gen-gtfs.py and src/data/generated.ts). Colors are from the
// official SEPTA Metro brand guide and the GTFS route_color field.

import { GENERATED_LINES } from "./generated";

export type Mode =
  | "rr"
  | "bsl"
  | "mfl"
  | "nhsl"
  | "trolley"
  | "girard"
  | "suburban-trolley";

export interface Line {
  id: string;
  metro?: string;
  name: string;
  short: string;
  mode: Mode;
  color: string;
  apiNames: string[];
  stationOrder: string[];
  shape: [number, number][];
}

export const lines: Line[] = GENERATED_LINES as Line[];

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
