import { afterEach, describe, expect, it, vi } from "vitest";
import { getAlerts, getTrains, getTransitVehicles } from "./septa";

function mockFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      text: async () => (body === undefined ? "" : JSON.stringify(body)),
    })),
  );
}

describe("septa client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shapes TrainView rows and parses numeric strings", async () => {
    mockFetch([
      {
        trainno: "9123",
        lat: "40.0123",
        lon: "-75.4567",
        line: "Paoli/Thorndale",
        dest: "Thorndale",
        currentstop: "Bryn Mawr",
        nextstop: "Rosemont",
        consist: "X",
        heading: "184",
        late: 3,
        service: "LOC",
        SOURCE: "SCADA",
        TRACK: "1",
        TRACK_CHANGE: "",
      },
    ]);
    const trains = await getTrains();
    expect(trains).toHaveLength(1);
    expect(trains[0].lat).toBeCloseTo(40.0123);
    expect(trains[0].lon).toBeCloseTo(-75.4567);
    expect(trains[0].lateMinutes).toBe(3);
    expect(trains[0].lineId).toBe("PAO");
  });

  it("drops trains with non-finite coordinates", async () => {
    mockFetch([
      { trainno: "9123", lat: "40.01", lon: "-75.45", line: "Paoli/Thorndale", dest: "Thorndale",
        currentstop: "Bryn Mawr", nextstop: "Rosemont", consist: "X", heading: "184", late: 3,
        service: "LOC", SOURCE: "SCADA", TRACK: "1", TRACK_CHANGE: "" },
      { trainno: "9124", lat: "", lon: "", line: "Paoli/Thorndale", dest: "Thorndale",
        currentstop: "", nextstop: "", consist: "X", heading: "0", late: 0,
        service: "LOC", SOURCE: "SCADA", TRACK: "", TRACK_CHANGE: "" },
    ]);
    const trains = await getTrains();
    expect(trains).toHaveLength(1);
    expect(trains[0].id).toBe("9123");
  });

  it("returns an empty list when upstream isn't an array", async () => {
    mockFetch({ error: "down" });
    expect(await getTrains()).toEqual([]);
    expect(await getAlerts()).toEqual([]);
  });

  it("returns an empty list when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    expect(await getTrains()).toEqual([]);
  });

  it("drops vehicles with non-finite coordinates", async () => {
    mockFetch({
      routes: [
        {
          "21": [
            { lat: "39.95", lng: "-75.16", VehicleID: "1001", label: "1001", trip: "t1", BlockID: "b1", destination: "Penn's Landing", Direction: "EB", Offset: "0", Offset_sec: "0", heading: 90, late: 0 },
            { lat: "not-a-number", lng: "-75.16", VehicleID: "1002", label: "1002", trip: "t2", BlockID: "b2", destination: "Penn's Landing", Direction: "EB", Offset: "0", Offset_sec: "0", heading: 90, late: 0 },
          ],
        },
      ],
    });
    const vehicles = await getTransitVehicles();
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].lat).toBeCloseTo(39.95);
  });

  it("treats SEPTA's 998/999 'no estimate' sentinels as unknown (0), keeps real values", async () => {
    mockFetch({
      routes: [
        {
          "21": [
            { lat: "39.95", lng: "-75.16", VehicleID: "A", label: "A", trip: "t1", BlockID: "b1", destination: "x", Direction: "EB", Offset: "0", Offset_sec: "0", heading: 90, late: 999 },
            { lat: "39.96", lng: "-75.16", VehicleID: "B", label: "B", trip: "t2", BlockID: "b2", destination: "x", Direction: "EB", Offset: "0", Offset_sec: "0", heading: 90, late: 998 },
            { lat: "39.97", lng: "-75.16", VehicleID: "C", label: "C", trip: "t3", BlockID: "b3", destination: "x", Direction: "EB", Offset: "0", Offset_sec: "0", heading: 90, late: 7 },
            { lat: "39.98", lng: "-75.16", VehicleID: "D", label: "D", trip: "t4", BlockID: "b4", destination: "x", Direction: "EB", Offset: "0", Offset_sec: "0", heading: 90, late: -3 },
          ],
        },
      ],
    });
    const vehicles = await getTransitVehicles();
    const byLabel = Object.fromEntries(vehicles.map((v) => [v.label, v.lateMinutes]));
    expect(byLabel.A).toBe(0); // 999 sentinel -> unknown
    expect(byLabel.B).toBe(0); // 998 sentinel -> unknown
    expect(byLabel.C).toBe(7); // real delay passes through
    expect(byLabel.D).toBe(-3); // running early passes through
  });

  it("classifies alert severity from the boolean string flags", async () => {
    mockFetch([
      { route_id: "rt15", route_name: "Route 15", mode: "Trolley", current_message: "Single-tracking",
        advisory_message: "", detour_message: "", detour_start_date_time: "", detour_end_date_time: "",
        detour_reason: "", isadvisory: "N", isdetour: "N", isalert: "Y", isdelay: "N", issuspend: "N", last_updated: "x" },
      { route_id: "rt23", route_name: "Route 23", mode: "Bus", current_message: "Detoured around 5th & Market",
        advisory_message: "", detour_message: "use 9th", detour_start_date_time: "", detour_end_date_time: "",
        detour_reason: "construction", isadvisory: "N", isdetour: "Y", isalert: "N", isdelay: "N", issuspend: "N", last_updated: "x" },
    ]);
    const alerts = await getAlerts();
    expect(alerts.map((a) => a.severity)).toEqual(["alert", "detour"]);
  });

  it("skips alerts that have no messages of any kind", async () => {
    mockFetch([
      { route_id: "rt15", route_name: "Route 15", mode: "Trolley", current_message: "", advisory_message: "",
        detour_message: "", detour_start_date_time: "", detour_end_date_time: "", detour_reason: "",
        isadvisory: "N", isdetour: "N", isalert: "Y", isdelay: "N", issuspend: "N", last_updated: "x" },
    ]);
    expect(await getAlerts()).toEqual([]);
  });
});
