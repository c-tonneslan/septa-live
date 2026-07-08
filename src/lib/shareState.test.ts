import { describe, it, expect } from "vitest";
import { encodeView, parseView, isStaleShare, type ViewState } from "./shareState";
import { lines } from "@/data/lines";

const ALL = lines.map((l) => l.id);
const someLines = ALL.slice(0, 2);

const base: ViewState = { lines: ALL, bus: [], selection: null, camera: null };

describe("shareState", () => {
  it("omits lines when all are on, and encodes a subset", () => {
    expect(encodeView(base)).toBe("");
    // (comma is URL-encoded in the raw string; assert the decoded round-trip)
    expect(parseView(encodeView({ ...base, lines: someLines })).lines).toEqual(someLines);
  });

  it("round-trips a subset of lines + bus", () => {
    const q = encodeView({ ...base, lines: someLines, bus: ["33", "47M"] });
    const p = parseView(q);
    expect(p.lines).toEqual(someLines);
    expect(p.bus).toEqual(["33", "47M"]);
  });

  it("drops unknown line ids on parse", () => {
    const p = parseView("?lines=GHOST," + someLines[0]);
    expect(p.lines).toEqual([someLines[0]]);
  });

  it("encodes + parses all three selection kinds (split on first colon)", () => {
    for (const kind of ["train", "vehicle", "station"] as const) {
      const q = encodeView({ ...base, selection: { kind, id: "R7-123:x" } });
      const p = parseView(q);
      expect(p.selection).toEqual({ kind, id: "R7-123:x" });
    }
  });

  it("round-trips the camera and rounds coordinates", () => {
    const q = encodeView({ ...base, camera: { center: [39.95312, -75.16789], zoom: 13 } });
    const p = parseView(q);
    expect(p.camera?.center[0]).toBeCloseTo(39.95312, 4);
    expect(p.camera?.zoom).toBe(13);
  });

  it("parses malformed input to null fields without throwing", () => {
    const p = parseView("?sel=bogus&c=notcoords&z=NaN");
    expect(p.selection).toBeNull();
    expect(p.camera).toBeNull();
  });

  it("stamps t only with withTimestamp + a selection", () => {
    expect(encodeView({ ...base, selection: { kind: "train", id: "1" } })).not.toContain("t=");
    const q = encodeView({ ...base, selection: { kind: "train", id: "1" } }, { withTimestamp: true, now: 1_700_000_000_000 });
    expect(q).toContain("t=1700000000");
  });

  it("flags a >4h-old share stale, a recent one fresh", () => {
    const now = 1_700_000_000_000;
    expect(isStaleShare(now / 1000 - 5 * 3600, now)).toBe(true);
    expect(isStaleShare(now / 1000 - 60, now)).toBe(false);
    expect(isStaleShare(null, now)).toBe(false);
  });
});
