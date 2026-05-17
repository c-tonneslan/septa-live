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

export const busRoutes: BusRoute[] = BUS_ROUTES as BusRoute[];

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
