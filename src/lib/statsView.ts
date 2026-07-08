// Pure derivations for the /stats reliability page, kept out of the server
// component so they're declarative and unit-testable.

export interface LineRollup {
  line: string;
  avgTrainsPerSample: number;
  onTimePct: number | null;
  avgDelay: number;
  majorDelays: number;
}

export interface HourBucket {
  hour: number;
  onTimePct: number | null;
  avgDelay: number;
  samples: number;
}

// The reliability snapshot is small and often stale (a 15-min GitHub Action
// that may lag), so we flag it honestly. SAMPLE_MIN must exceed the current
// snapshot count (~45) or the "thin sample" caveat would never show.
export const SAMPLE_MIN = 100;

export function isThinSample(totalSnapshots: number): boolean {
  return totalSnapshots < SAMPLE_MIN;
}

export interface RankedLine extends LineRollup {
  rank: number;
}

// Rated lines first (kept in their incoming on-time order), unrated pushed to
// the bottom, each given a 1-based rank.
export function rankLines(lines: LineRollup[]): RankedLine[] {
  const rated = lines.filter((l) => l.onTimePct !== null);
  const unrated = lines.filter((l) => l.onTimePct === null);
  return [...rated, ...unrated].map((l, i) => ({ ...l, rank: i + 1 }));
}

export function bestWorst(lines: LineRollup[]): { best: LineRollup | null; worst: LineRollup | null } {
  const rated = lines.filter((l) => l.onTimePct !== null);
  if (rated.length < 2) return { best: null, worst: null };
  const sorted = [...rated].sort((a, b) => (b.onTimePct as number) - (a.onTimePct as number));
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export interface Freshness {
  ageMs: number;
  isStale: boolean;
  label: string;
}

// Stale if the snapshot is more than 6 hours old (the Action runs every 15 min,
// so 6h means it has clearly stopped).
export function freshness(generatedAt: string, now = Date.now()): Freshness {
  const t = new Date(generatedAt).getTime();
  const ageMs = Number.isFinite(t) ? Math.max(0, now - t) : 0;
  return { ageMs, isStale: ageMs > 6 * 3_600_000, label: humanizeAge(ageMs) };
}

function humanizeAge(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min old`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} hr old`;
  const days = Math.round(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} old`;
}
