// Bus route catalog (small, bundled) + lazy loader for the heavy
// shape/stops payload (served as a static JSON file from /bus-routes.json).
// The catalog is enough to render the sidebar list and resolve route_id to a
// brand color; full geometry only fetches when the user toggles a route on.

import { BUS_ROUTES } from "./generated";

export interface BusRoute {
  id: string;
  short: string;
  name: string;
  color: string;
}

export interface BusStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface BusRouteData {
  shape: [number, number][];
  stops: BusStop[];
}

// SEPTA's GTFS route_color for buses is often grey, near-black, or missing —
// rail lines get a distinctive brand color, buses mostly don't. On a dark
// basemap those colors disappear, so brighten anything below a luminance
// threshold to a vivid version of the same hue (or amber if it's literally
// just grey). Rail/metro lines already pick from the SEPTA Metro palette so
// they don't go through here.
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return "#" + [r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("");
}
function luminance([r, g, b]: [number, number, number]): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function brighten(hex: string): string {
  const rgb = hexToRgb(hex);
  const lum = luminance(rgb);
  // If it's already bright enough, leave it alone.
  if (lum >= 0.55) return hex;
  // Pure grey (R≈G≈B) just gets remapped to a default bus amber, since
  // brightening grey still produces grey.
  const [r, g, b] = rgb;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread < 10) return "#F59E0B";
  // Otherwise: scale RGB so the brightest channel hits 230. Keeps the hue,
  // just pushes the value way up.
  const peak = Math.max(r, g, b);
  const factor = 230 / Math.max(peak, 1);
  return rgbToHex(r * factor, g * factor, b * factor);
}

const raw: BusRoute[] = BUS_ROUTES as BusRoute[];
export const busRoutes: BusRoute[] = raw.map((r) => ({ ...r, color: brighten(r.color) }));

const byId = new Map<string, BusRoute>();
for (const r of busRoutes) byId.set(r.id, r);

export function lookupBusRoute(id: string | null | undefined): BusRoute | null {
  if (!id) return null;
  return byId.get(id) ?? null;
}

let dataPromise: Promise<Record<string, BusRouteData>> | null = null;

export function loadBusData(): Promise<Record<string, BusRouteData>> {
  if (!dataPromise) {
    dataPromise = fetch("/bus-routes.json")
      .then((r) => {
        if (!r.ok) throw new Error(`bus-routes.json: ${r.status}`);
        return r.json() as Promise<Record<string, BusRouteData>>;
      })
      .catch((e) => {
        // Reset so a future call retries.
        dataPromise = null;
        throw e;
      });
  }
  return dataPromise;
}
