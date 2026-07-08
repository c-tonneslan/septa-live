import { describe, it, expect } from "vitest";
import {
  rankLines,
  bestWorst,
  freshness,
  isThinSample,
  SAMPLE_MIN,
  type LineRollup,
} from "./statsView";

const line = (name: string, onTimePct: number | null): LineRollup => ({
  line: name,
  avgTrainsPerSample: 2,
  onTimePct,
  avgDelay: 3,
  majorDelays: 0,
});

describe("statsView", () => {
  it("flags the current ~45-snapshot sample as thin", () => {
    expect(isThinSample(45)).toBe(true);
    expect(SAMPLE_MIN).toBeGreaterThan(45);
    expect(isThinSample(SAMPLE_MIN)).toBe(false);
  });

  it("freshness flags an old snapshot stale with a day-scale label", () => {
    const gen = "2026-05-31T09:58:33.964Z";
    const now = new Date("2026-07-07T00:00:00Z").getTime();
    const f = freshness(gen, now);
    expect(f.isStale).toBe(true);
    expect(f.label).toMatch(/day/);
  });

  it("freshness treats a minutes-old snapshot as fresh", () => {
    const now = Date.now();
    const gen = new Date(now - 10 * 60_000).toISOString();
    expect(freshness(gen, now).isStale).toBe(false);
  });

  it("rankLines preserves order and pushes null-onTime rows last", () => {
    const ranked = rankLines([line("A", 90), line("Z", null), line("B", 80)]);
    expect(ranked.map((l) => l.line)).toEqual(["A", "B", "Z"]);
    expect(ranked.map((l) => l.rank)).toEqual([1, 2, 3]);
  });

  it("bestWorst skips null rows and picks the extremes", () => {
    const { best, worst } = bestWorst([line("A", 70), line("N", null), line("B", 95), line("C", 60)]);
    expect(best?.line).toBe("B");
    expect(worst?.line).toBe("C");
  });

  it("bestWorst returns nulls when fewer than 2 rated lines", () => {
    expect(bestWorst([])).toEqual({ best: null, worst: null });
    expect(bestWorst([line("A", 90), line("N", null)])).toEqual({ best: null, worst: null });
  });
});
