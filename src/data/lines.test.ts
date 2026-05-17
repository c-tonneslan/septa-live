import { describe, it, expect } from "vitest";
import { lookupLine, lines } from "./lines";

describe("lookupLine", () => {
  it("resolves canonical IDs", () => {
    expect(lookupLine("BSL")?.short).toBe("B");
    expect(lookupLine("MFL")?.short).toBe("L");
    expect(lookupLine("NHSL")?.short).toBe("M");
    expect(lookupLine("PAO")?.name).toBe("Paoli/Thorndale");
  });

  it("resolves SEPTA Metro letters", () => {
    expect(lookupLine("L")?.id).toBe("MFL");
    expect(lookupLine("B")?.id).toBe("BSL");
    expect(lookupLine("M")?.id).toBe("NHSL");
  });

  it("resolves the multiple ways SEPTA spells the same line", () => {
    // SEPTA's feeds are inconsistent — the same line shows up under different
    // names across endpoints, and even multiple times within one response.
    expect(lookupLine("Chestnut Hill East")?.id).toBe("CHE");
    expect(lookupLine("Chestnut Hl East")?.id).toBe("CHE");
    expect(lookupLine("Chestnut H East")?.id).toBe("CHE");
    expect(lookupLine("Media/Wawa")?.id).toBe("MED");
    expect(lookupLine("Wawa")?.id).toBe("MED");
    expect(lookupLine("Elwyn")?.id).toBe("MED");
  });

  it("resolves bus-feed GTFS IDs onto the metro lines", () => {
    expect(lookupLine("L1")?.id).toBe("MFL");
    expect(lookupLine("B1")?.id).toBe("BSL");
    expect(lookupLine("M1")?.id).toBe("NHSL");
  });

  it("is case-insensitive on the friendly spelling", () => {
    expect(lookupLine("trenton")?.id).toBe("TRE");
    expect(lookupLine("TRENTON")?.id).toBe("TRE");
  });

  it("returns null for unknown / empty input", () => {
    expect(lookupLine(null)).toBeNull();
    expect(lookupLine(undefined)).toBeNull();
    expect(lookupLine("")).toBeNull();
    expect(lookupLine("does not exist")).toBeNull();
  });
});

describe("lines registry", () => {
  it("includes every Regional Rail line", () => {
    const ids = new Set(lines.filter((l) => l.mode === "rr").map((l) => l.id));
    for (const expected of ["AIR", "CHE", "CHW", "CYN", "FOX", "LAN", "MED", "NOR", "PAO", "TRE", "WAR", "WTR", "WIL"]) {
      expect(ids.has(expected)).toBe(true);
    }
  });

  it("every line has a non-empty shape with at least two points", () => {
    for (const line of lines) {
      expect(line.shape.length).toBeGreaterThanOrEqual(2);
      for (const [lat, lon] of line.shape) {
        expect(Number.isFinite(lat)).toBe(true);
        expect(Number.isFinite(lon)).toBe(true);
      }
    }
  });

  it("every line has a brand color hex string", () => {
    for (const line of lines) {
      expect(line.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
