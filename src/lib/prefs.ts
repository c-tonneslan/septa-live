import { lines } from "@/data/lines";
import { busRoutes } from "@/data/buses";

// Remember the rider's line / bus-route selection across visits so a rail-only
// commuter isn't re-hiding ~22 of 23 lines every time. Versioned + validated so
// a future line-list change can't crash on stale saved data.
export const PREFS_KEY = "septa-live:prefs";
export const PREFS_VERSION = 1;

interface StoredPrefs {
  v: number;
  lines: string[];
  bus: string[];
}

// Guard on localStorage itself (undefined during Next SSR AND in the node
// vitest runner), never `window`, so this is both SSR-safe and unit-testable.
function store(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

const KNOWN_LINES = new Set(lines.map((l) => l.id));
const KNOWN_BUS = new Set(busRoutes.map((b) => b.id));

// null = "no saved prefs" (distinct from a valid saved empty selection).
export function loadPrefs(): { lines: string[]; bus: string[] } | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(PREFS_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as StoredPrefs;
    if (!parsed || parsed.v !== PREFS_VERSION) return null;
    // Drop ids that no longer exist so a regenerated line list can't poison state.
    return {
      lines: (Array.isArray(parsed.lines) ? parsed.lines : []).filter((id) => KNOWN_LINES.has(id)),
      bus: (Array.isArray(parsed.bus) ? parsed.bus : []).filter((id) => KNOWN_BUS.has(id)),
    };
  } catch {
    return null;
  }
}

export function savePrefs(p: { lines: string[]; bus: string[] }): void {
  const s = store();
  if (!s) return;
  try {
    const payload: StoredPrefs = { v: PREFS_VERSION, lines: p.lines, bus: p.bus };
    s.setItem(PREFS_KEY, JSON.stringify(payload));
  } catch {
    /* Safari private mode throws on setItem — degrade silently. */
  }
}

export function clearPrefs(): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(PREFS_KEY);
  } catch {
    /* ignore */
  }
}
