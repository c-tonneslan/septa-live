import { describe, it, expect } from "vitest";
import { stations, lookupStation, hasRegionalRail, stationModes } from "./stations";

describe("lookupStation", () => {
  it("finds Center City hub stations by their canonical SEPTA name", () => {
    expect(lookupStation("Suburban Station")?.name).toBe("Suburban Station");
    expect(lookupStation("Jefferson Station")?.name).toBe("Jefferson Station");
    expect(lookupStation("Gray 30th St Station")?.name).toBe("Gray 30th St Station");
  });

  it("is case-insensitive", () => {
    expect(lookupStation("suburban station")?.name).toBe("Suburban Station");
  });

  it("returns null for unknown / empty", () => {
    expect(lookupStation(null)).toBeNull();
    expect(lookupStation(undefined)).toBeNull();
    expect(lookupStation("not a station")).toBeNull();
  });
});

describe("stations bundle", () => {
  it("has coords within the SEPTA service area bounding box", () => {
    // Loose box covering Wilmington DE to Doylestown PA, Newark DE to Trenton NJ
    for (const s of stations) {
      expect(s.lat).toBeGreaterThan(39.6);
      expect(s.lat).toBeLessThan(40.4);
      expect(s.lon).toBeGreaterThan(-75.8);
      expect(s.lon).toBeLessThan(-74.7);
    }
  });

  it("MFL underground stations sit on the real Market Street latitude", () => {
    // Market Street through Center City runs at lat ~39.952-39.953. The
    // previous hand-curated coords were ~39.95 (clearly wrong). Spot-check
    // the GTFS-derived coords are on the actual street.
    const s = lookupStation("15th St/City Hall");
    expect(s).not.toBeNull();
    expect(s!.lat).toBeGreaterThan(39.95);
    expect(s!.lat).toBeLessThan(39.96);
    expect(s!.lon).toBeGreaterThan(-75.17);
    expect(s!.lon).toBeLessThan(-75.16);
  });

  it("BSL stations sit on the Broad Street longitude axis", () => {
    // Broad Street runs at lon ~-75.16 to -75.17 (drifts a bit south).
    const cityHallBsl = stations.find((s) => s.name === "15th St/City Hall" && s.lineIds.includes("BSL"));
    expect(cityHallBsl).toBeDefined();
    expect(cityHallBsl!.lon).toBeGreaterThan(-75.17);
    expect(cityHallBsl!.lon).toBeLessThan(-75.16);
  });
});

describe("stationModes / hasRegionalRail", () => {
  it("classifies Suburban Station as RR", () => {
    const s = lookupStation("Suburban Station")!;
    expect(hasRegionalRail(s)).toBe(true);
    expect(stationModes(s)).toContain("rr");
  });

  it("classifies BSL-only stations as non-RR", () => {
    const fairmount = stations.find((s) => s.name === "Fairmount" && s.lineIds.includes("BSL"));
    expect(fairmount).toBeDefined();
    expect(hasRegionalRail(fairmount!)).toBe(false);
  });
});
