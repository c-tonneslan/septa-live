import { describe, it, expect } from "vitest";
import { compile, route, type Network } from "./router";

// Synthetic network for testing. Three lines:
//   L1: A → B → C → D
//   L2: B → X → Y → Z
//   L3: D → Y → W
// Walking transfer between B (L1) and B (L2) is implicit (same stop id).
// Walking transfer between D-pivot and Y-pivot via the actual graph.
function net(): Network {
  return {
    stops: [
      { id: "A", name: "A", lat: 0.0, lon: 0.0, modes: ["bus"], lineIds: ["L1"] },
      { id: "B", name: "B", lat: 0.0, lon: 0.01, modes: ["bus"], lineIds: ["L1", "L2"] },
      { id: "C", name: "C", lat: 0.0, lon: 0.02, modes: ["bus"], lineIds: ["L1"] },
      { id: "D", name: "D", lat: 0.0, lon: 0.03, modes: ["bus"], lineIds: ["L1", "L3"] },
      { id: "X", name: "X", lat: 0.01, lon: 0.01, modes: ["bus"], lineIds: ["L2"] },
      { id: "Y", name: "Y", lat: 0.02, lon: 0.01, modes: ["bus"], lineIds: ["L2", "L3"] },
      { id: "Z", name: "Z", lat: 0.03, lon: 0.01, modes: ["bus"], lineIds: ["L2"] },
      { id: "W", name: "W", lat: 0.02, lon: 0.03, modes: ["bus"], lineIds: ["L3"] },
    ],
    routes: {
      L1: { color: "#f00", mode: "bus", name: "Line 1", short: "L1", stops: ["A", "B", "C", "D"] },
      L2: { color: "#0f0", mode: "bus", name: "Line 2", short: "L2", stops: ["B", "X", "Y", "Z"] },
      L3: { color: "#00f", mode: "bus", name: "Line 3", short: "L3", stops: ["D", "Y", "W"] },
    },
    transfers: [],
    speeds: { bus: 12 },
  };
}

describe("router", () => {
  it("finds a direct route", () => {
    const g = compile(net());
    const trip = route(g, "A", "D");
    expect(trip).not.toBeNull();
    expect(trip!.transfers).toBe(0);
    expect(trip!.legs).toHaveLength(1);
    expect(trip!.legs[0].kind).toBe("ride");
    if (trip!.legs[0].kind === "ride") {
      expect(trip!.legs[0].routeId).toBe("L1");
    }
  });

  it("finds a one-transfer route", () => {
    const g = compile(net());
    const trip = route(g, "A", "Z");
    expect(trip).not.toBeNull();
    expect(trip!.transfers).toBe(1);
    const ridelegs = trip!.legs.filter((l) => l.kind === "ride");
    expect(ridelegs.length).toBe(2);
    if (ridelegs[0].kind === "ride") expect(ridelegs[0].routeId).toBe("L1");
    if (ridelegs[1].kind === "ride") expect(ridelegs[1].routeId).toBe("L2");
  });

  it("prefers fewer transfers", () => {
    // A → D direct on L1 should beat A → L1 → B → L2 → … even if the
    // alternative legs are short.
    const g = compile(net());
    const trip = route(g, "A", "D");
    expect(trip!.transfers).toBe(0);
  });

  it("returns null for non-existent stops", () => {
    const g = compile(net());
    expect(route(g, "A", "NOPE")).toBeNull();
    expect(route(g, "NOPE", "A")).toBeNull();
  });

  it("returns null when origin === destination", () => {
    const g = compile(net());
    expect(route(g, "A", "A")).toBeNull();
  });

  it("reports total minutes greater than zero", () => {
    const g = compile(net());
    const trip = route(g, "A", "D")!;
    expect(trip.totalMinutes).toBeGreaterThan(0);
  });
});
