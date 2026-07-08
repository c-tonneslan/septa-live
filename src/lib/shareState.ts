import { lines } from "@/data/lines";

// Serialize/parse the shareable view into the querystring (?lines=&bus=&sel=&c=&z=&t=).
// Querystring, not hash, to match /embed's existing ?lines= convention. Pure and
// total: parse never throws — bad fields are dropped.
//
// The DURABLE payload (lines + camera) always reproduces. The PERISHABLE part
// (a selected train/vehicle) is best-effort: a shared vehicle may have finished
// its trip, and a train number is reused next service day — so `t` stamps when
// the link was made and the app drops a stale selection rather than chase a
// wrong unit.

const ALL_LINE_IDS = lines.map((l) => l.id);
const KNOWN_LINES = new Set(ALL_LINE_IDS);

export interface ViewState {
  lines: string[];
  bus: string[];
  selection: { kind: "train" | "vehicle" | "station"; id: string } | null;
  camera: { center: [number, number]; zoom: number } | null;
}

export interface ParsedView {
  lines: string[] | null; // null = not specified (fall back to prefs/default)
  bus: string[] | null;
  selection: { kind: "train" | "vehicle" | "station"; id: string } | null;
  camera: { center: [number, number]; zoom: number } | null;
  t: number | null; // epoch seconds when the link was made
}

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export function encodeView(v: ViewState, opts: { withTimestamp?: boolean; now?: number } = {}): string {
  const sp = new URLSearchParams();
  // Omit `lines` when every line is on (the default), so a bare link stays clean.
  const allOn = v.lines.length === ALL_LINE_IDS.length && ALL_LINE_IDS.every((id) => v.lines.includes(id));
  if (!allOn) sp.set("lines", v.lines.join(","));
  if (v.bus.length) sp.set("bus", v.bus.join(","));
  if (v.selection) sp.set("sel", `${v.selection.kind}:${v.selection.id}`);
  if (v.camera) {
    sp.set("c", `${round(v.camera.center[0], 5)},${round(v.camera.center[1], 5)}`);
    sp.set("z", String(Math.round(v.camera.zoom)));
  }
  if (opts.withTimestamp && v.selection) {
    sp.set("t", String(Math.floor((opts.now ?? Date.now()) / 1000)));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function parseView(search: string): ParsedView {
  const sp = new URLSearchParams(search);
  const out: ParsedView = { lines: null, bus: null, selection: null, camera: null, t: null };

  const linesRaw = sp.get("lines");
  if (linesRaw !== null) {
    out.lines = linesRaw.split(",").map((s) => s.trim()).filter((id) => KNOWN_LINES.has(id));
  }
  const busRaw = sp.get("bus");
  if (busRaw !== null) {
    out.bus = busRaw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  const sel = sp.get("sel");
  if (sel) {
    const idx = sel.indexOf(":");
    if (idx > 0) {
      const kind = sel.slice(0, idx);
      const id = sel.slice(idx + 1);
      if ((kind === "train" || kind === "vehicle" || kind === "station") && id) {
        out.selection = { kind, id };
      }
    }
  }

  const c = sp.get("c");
  const z = sp.get("z");
  if (c && z) {
    const [lat, lon] = c.split(",").map(Number);
    const zoom = Number(z);
    if (
      Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(zoom) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && zoom >= 0 && zoom <= 22
    ) {
      out.camera = { center: [lat, lon], zoom };
    }
  }

  const t = sp.get("t");
  if (t) {
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) out.t = n;
  }
  return out;
}

// A shared train/vehicle selection older than ~4h can't be trusted — the vehicle
// has likely finished its trip and a train number is reused the next service day.
export function isStaleShare(t: number | null, now = Date.now()): boolean {
  if (t == null) return false;
  return now - t * 1000 > 4 * 3_600_000;
}
