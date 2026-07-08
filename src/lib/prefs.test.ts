import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { lines } from "@/data/lines";
import { loadPrefs, savePrefs, clearPrefs, PREFS_KEY } from "./prefs";

// In-memory Storage shim (the node vitest env has no localStorage).
function makeShim(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

const realLine = lines[0].id;

describe("prefs", () => {
  afterEach(() => {
    // @ts-expect-error test teardown
    delete globalThis.localStorage;
  });

  describe("with storage", () => {
    beforeEach(() => {
      (globalThis as unknown as { localStorage: Storage }).localStorage = makeShim();
    });

    it("round-trips saved ids", () => {
      savePrefs({ lines: [realLine], bus: [] });
      expect(loadPrefs()).toEqual({ lines: [realLine], bus: [] });
    });

    it("drops ids that no longer exist in the live catalog", () => {
      savePrefs({ lines: [realLine, "GHOST_LINE"], bus: ["GHOST_BUS"] });
      const p = loadPrefs();
      expect(p?.lines).toEqual([realLine]);
      expect(p?.bus).toEqual([]);
    });

    it("returns null on a version mismatch", () => {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ v: 999, lines: [realLine], bus: [] }));
      expect(loadPrefs()).toBeNull();
    });

    it("returns null on malformed JSON", () => {
      localStorage.setItem(PREFS_KEY, "{not json");
      expect(loadPrefs()).toBeNull();
    });

    it("preserves a saved empty selection (hide-all) rather than treating it as no-prefs", () => {
      savePrefs({ lines: [], bus: [] });
      expect(loadPrefs()).toEqual({ lines: [], bus: [] });
    });

    it("returns null when the key is absent", () => {
      expect(loadPrefs()).toBeNull();
    });

    it("clearPrefs removes the key", () => {
      savePrefs({ lines: [realLine], bus: [] });
      clearPrefs();
      expect(loadPrefs()).toBeNull();
    });
  });

  describe("without storage (SSR / private mode)", () => {
    it("load/save/clear are no-ops that never throw", () => {
      expect(() => savePrefs({ lines: [realLine], bus: [] })).not.toThrow();
      expect(loadPrefs()).toBeNull();
      expect(() => clearPrefs()).not.toThrow();
    });
  });
});
