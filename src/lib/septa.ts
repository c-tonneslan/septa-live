// SEPTA public-API client. All endpoints are unauthenticated, return JSON, and
// occasionally return something other than JSON when the upstream errors out.
// Every call wraps the fetch in a try/catch and returns a typed empty result on
// failure so the UI never has to special-case "the API broke".

import { lookupLine } from "@/data/lines";
import { lookupStation } from "@/data/stations";

const BASE = "https://www3.septa.org/api";

// --- raw upstream shapes ----------------------------------------------------

interface RawTrain {
  lat: string;
  lon: string;
  trainno: string;
  service: string;
  dest: string;
  currentstop: string;
  nextstop: string;
  line: string;
  consist: string;
  heading: string;
  late: number;
  SOURCE: string;
  TRACK: string;
  TRACK_CHANGE: string;
}

interface RawArrival {
  direction: string;
  path: string;
  train_id: string;
  origin: string;
  destination: string;
  line: string;
  status: string;
  service_type: string;
  next_station: string | null;
  sched_time: string;
  depart_time: string;
  track: string;
  track_change: string | null;
  platform: string;
  platform_change: string | null;
}

interface RawAlert {
  route_id: string;
  route_name: string;
  mode: string;
  current_message: string;
  advisory_message: string;
  detour_message: string;
  detour_start_date_time: string;
  detour_end_date_time: string;
  detour_reason: string;
  isadvisory: string;
  isdetour: string;
  isalert: string;
  isdelay: string;
  issuspend: string;
  isservicechange?: string;
  last_updated: string;
}

// --- clean outbound shapes --------------------------------------------------

export interface Train {
  id: string;
  lat: number;
  lon: number;
  line: string;
  lineId: string | null;
  lineColor: string;
  lineShort: string | null;
  destination: string;
  currentStop: string;
  nextStop: string;
  heading: number;
  lateMinutes: number;
  service: string;
  track: string;
  source: string;
}

export interface Arrival {
  trainId: string;
  direction: string;
  origin: string;
  destination: string;
  line: string;
  lineId: string | null;
  lineColor: string;
  status: string;
  scheduledTime: string;
  departTime: string;
  track: string;
  platform: string;
  nextStation: string | null;
}

export interface StationArrivals {
  station: string;
  generatedAt: string;
  northbound: Arrival[];
  southbound: Arrival[];
  note?: string;
}

export interface Alert {
  routeId: string;
  routeName: string;
  mode: string;
  message: string;
  advisory: string;
  detour: string;
  severity: "alert" | "delay" | "detour" | "advisory" | "suspension";
  lastUpdated: string;
}

export interface Vehicle {
  id: string;
  label: string;
  lat: number;
  lon: number;
  rawRouteId: string;
  lineId: string | null;
  lineColor: string;
  lineShort: string | null;
  destination: string;
  heading: number;
  lateMinutes: number;
  nextStop: string;
  trip: string;
}

export interface ElevatorOutage {
  line: string;
  station: string;
  elevator: string;
  message: string;
  alternateUrl: string;
}

// --- helpers ----------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 15 } });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text === "[]") return JSON.parse(text || "[]") as T;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function parseFloatSafe(n: string | number | null | undefined, fallback = 0): number {
  if (n === null || n === undefined) return fallback;
  const v = typeof n === "number" ? n : parseFloat(n);
  return Number.isFinite(v) ? v : fallback;
}

// --- public API -------------------------------------------------------------

export async function getTrains(): Promise<Train[]> {
  const raw = await fetchJson<RawTrain[]>(`${BASE}/TrainView/index.php`);
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    const line = lookupLine(t.line);
    return {
      id: t.trainno,
      lat: parseFloatSafe(t.lat),
      lon: parseFloatSafe(t.lon),
      line: t.line,
      lineId: line?.id ?? null,
      lineColor: line?.color ?? "#888",
      lineShort: line?.short ?? null,
      destination: t.dest,
      currentStop: t.currentstop,
      nextStop: t.nextstop,
      heading: parseFloatSafe(t.heading),
      lateMinutes: typeof t.late === "number" ? t.late : parseFloatSafe(t.late, 0),
      service: t.service,
      track: t.TRACK,
      source: t.SOURCE,
    };
  });
}

export async function getArrivals(
  stationName: string,
  results = 8,
): Promise<StationArrivals> {
  const station = lookupStation(stationName);
  // The upstream Arrivals endpoint matches case-sensitively on the canonical
  // station name. Use the curated canonical when available, fall back to the
  // user-supplied string otherwise.
  const canonical = station?.name ?? stationName;

  // Short-circuit: SEPTA's Arrivals API is Regional Rail only. Subway stations
  // would 500 upstream with an "invalid parameter" error, so skip the call and
  // return a clean empty payload with a note the UI can render.
  if (station && !station.lineIds.some((id) => lookupLine(id)?.mode === "rr")) {
    return {
      station: canonical,
      generatedAt: new Date().toISOString(),
      northbound: [],
      southbound: [],
      note: "SEPTA's public Arrivals API only covers Regional Rail. Subway realtime isn't published.",
    };
  }

  const url = `${BASE}/Arrivals/index.php?station=${encodeURIComponent(canonical)}&results=${results}`;
  const raw = await fetchJson<Record<string, unknown>>(url);

  const empty = (note?: string): StationArrivals => ({
    station: canonical,
    generatedAt: new Date().toISOString(),
    northbound: [],
    southbound: [],
    note,
  });

  if (!raw) return empty("Couldn't reach SEPTA. Try again in a moment.");
  if (typeof raw === "object" && raw !== null && "error" in raw) {
    return empty(typeof raw.error === "string" ? raw.error : undefined);
  }

  // Upstream wraps the array in a key like "Suburban Station Departures: ...".
  const topKey = Object.keys(raw)[0];
  if (!topKey) return empty();
  const payload = raw[topKey] as Array<{ Northbound?: RawArrival[]; Southbound?: RawArrival[] }>;
  if (!Array.isArray(payload)) return empty();
  const generatedAt = topKey.split(": ").slice(1).join(": ") || new Date().toISOString();

  let north: RawArrival[] = [];
  let south: RawArrival[] = [];
  for (const group of payload) {
    if (group.Northbound) north = group.Northbound;
    if (group.Southbound) south = group.Southbound;
  }

  const shape = (a: RawArrival): Arrival => {
    const line = lookupLine(a.line);
    return {
      trainId: a.train_id,
      direction: a.direction,
      origin: a.origin,
      destination: a.destination,
      line: a.line,
      lineId: line?.id ?? null,
      lineColor: line?.color ?? "#888",
      status: a.status,
      scheduledTime: a.sched_time,
      departTime: a.depart_time,
      track: a.track,
      platform: a.platform,
      nextStation: a.next_station,
    };
  };

  return {
    station: canonical,
    generatedAt,
    northbound: north.map(shape),
    southbound: south.map(shape),
  };
}

// TransitViewAll wraps every vehicle under {"routes":[{"<route_id>":[...]}]}.
// Each route is keyed by its SEPTA Metro/route id ("T2", "L", "B", "M", "15",
// "33", etc). We only want vehicles whose route resolves to a known non-RR
// line (so we don't dump every bus onto the map); RR positions come from the
// dedicated TrainView endpoint above.
interface RawTransitVehicle {
  lat: string;
  lng: string;
  label: string;
  VehicleID: string;
  route_id?: string;
  BlockID: string;
  Direction: string;
  destination: string;
  Offset: string;
  heading: number | string;
  late: number;
  original_late?: number;
  Offset_sec: string;
  trip: string;
  next_stop_id?: string;
  next_stop_name?: string;
}

export async function getTransitVehicles(): Promise<Vehicle[]> {
  const raw = await fetchJson<{ routes?: Array<Record<string, RawTransitVehicle[]>> }>(
    `${BASE}/TransitViewAll/index.php`,
  );
  if (!raw?.routes) return [];

  const out: Vehicle[] = [];
  const seen = new Set<string>();
  for (const group of raw.routes) {
    for (const [routeId, vehicles] of Object.entries(group)) {
      const line = lookupLine(routeId);
      // Skip routes we don't render (every bus route). Keep BSL/MFL/NHSL/trolleys.
      if (!line || line.mode === "rr") continue;
      for (const v of vehicles) {
        const lat = parseFloatSafe(v.lat);
        const lon = parseFloatSafe(v.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        // SEPTA occasionally reports vehicles with VehicleID="None" (apprentice
        // runs, ghosts, freshly-dispatched units), so VehicleID alone isn't
        // unique. trip + block disambiguates because two vehicles can't share
        // a block schedule. Fall back to lat/lon when the upstream gives us
        // nothing useful at all.
        const idParts = [
          routeId,
          v.VehicleID || v.label || "x",
          v.trip || v.BlockID || `${lat.toFixed(4)},${lon.toFixed(4)}`,
        ];
        let id = idParts.join("-");
        if (seen.has(id)) id = `${id}-${out.length}`;
        seen.add(id);
        out.push({
          id,
          label: v.label || v.VehicleID || "—",
          lat,
          lon,
          rawRouteId: routeId,
          lineId: line.id,
          lineColor: line.color,
          lineShort: line.short,
          destination: v.destination || "",
          heading: parseFloatSafe(v.heading),
          lateMinutes: typeof v.late === "number" ? v.late : parseFloatSafe(v.late, 0),
          nextStop: v.next_stop_name || "",
          trip: v.trip || "",
        });
      }
    }
  }
  return out;
}

export async function getElevatorOutages(): Promise<ElevatorOutage[]> {
  const raw = await fetchJson<{
    meta?: { elevators_out?: number; updated?: string };
    results?: Array<{
      line: string;
      station: string;
      elevator: string;
      message: string;
      alternate_url?: string;
    }>;
  }>(`${BASE}/elevator/index.php`);
  if (!raw?.results) return [];
  return raw.results.map((r) => ({
    line: r.line,
    station: r.station,
    elevator: r.elevator,
    message: r.message,
    alternateUrl: r.alternate_url ?? "",
  }));
}

export async function getAlerts(): Promise<Alert[]> {
  const raw = await fetchJson<RawAlert[]>(`${BASE}/Alerts/index.php`);
  if (!Array.isArray(raw)) return [];
  const out: Alert[] = [];
  for (const a of raw) {
    const message = a.current_message?.trim() ?? "";
    const advisory = a.advisory_message?.trim() ?? "";
    const detour = a.detour_message?.trim() ?? "";
    if (!message && !advisory && !detour) continue;
    let severity: Alert["severity"] = "advisory";
    if (a.issuspend === "Y") severity = "suspension";
    else if (a.isalert === "Y") severity = "alert";
    else if (a.isdelay === "Y") severity = "delay";
    else if (a.isdetour === "Y") severity = "detour";
    out.push({
      routeId: a.route_id,
      routeName: a.route_name,
      mode: a.mode,
      message,
      advisory,
      detour,
      severity,
      lastUpdated: a.last_updated,
    });
  }
  return out;
}
