import { describe, it, expect } from "vitest";
import { busRoutes, lookupBusRoute } from "./buses";

describe("busRoutes catalog", () => {
  it("has at least the dozen most-recognizable Philly bus routes", () => {
    const ids = new Set(busRoutes.map((r) => r.id));
    // These all run constantly through Center City and are about as
    // recognizable to a Philly transit rider as a route gets.
    for (const expected of ["2", "3", "4", "23", "33", "47", "48"]) {
      expect(ids.has(expected)).toBe(true);
    }
  });

  it("every catalog entry has a hex color string", () => {
    for (const r of busRoutes) {
      expect(r.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("brightens dark / grey GTFS colors so they read on the dark map", () => {
    // Sample a chunk of routes. The brightening fn replaces pure grey with
    // amber #F59E0B and scales dark non-grey toward a brighter version. No
    // route should end up so dark it disappears on #0b0f14.
    const dark = busRoutes.filter((r) => {
      const h = r.color.replace("#", "");
      const lum =
        0.299 * parseInt(h.slice(0, 2), 16) +
        0.587 * parseInt(h.slice(2, 4), 16) +
        0.114 * parseInt(h.slice(4, 6), 16);
      return lum < 60;
    });
    expect(dark.length).toBe(0);
  });
});

describe("lookupBusRoute", () => {
  it("resolves by GTFS route_id", () => {
    expect(lookupBusRoute("23")?.short).toBeDefined();
    expect(lookupBusRoute("33")?.short).toBeDefined();
  });

  it("returns null for unknown / empty", () => {
    expect(lookupBusRoute(null)).toBeNull();
    expect(lookupBusRoute(undefined)).toBeNull();
    expect(lookupBusRoute("")).toBeNull();
    expect(lookupBusRoute("totally-fake-route")).toBeNull();
  });
});
