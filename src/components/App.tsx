"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import AlertsBar from "./AlertsBar";
import type { Train, Vehicle, Alert, ElevatorOutage } from "@/lib/septa";
import { lines } from "@/data/lines";
import { stations } from "@/data/stations";
import { loadBusData, type BusRouteData } from "@/data/buses";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center text-muted">
      loading map…
    </div>
  ),
});

export type Selection =
  | { kind: "train"; id: string }
  | { kind: "vehicle"; id: string }
  | { kind: "station"; id: string }
  | null;

const TRAINS_POLL_MS = 15_000;
const VEHICLES_POLL_MS = 15_000;
const ALERTS_POLL_MS = 60_000;
const ELEVATORS_POLL_MS = 300_000;

export default function App() {
  const [trains, setTrains] = useState<Train[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [elevators, setElevators] = useState<ElevatorOutage[]>([]);
  const [trainsAt, setTrainsAt] = useState<string | null>(null);
  const [enabledLines, setEnabledLines] = useState<Set<string>>(
    () => new Set(lines.map((l) => l.id)),
  );
  const [enabledBusRoutes, setEnabledBusRoutes] = useState<Set<string>>(() => new Set());
  const [busData, setBusData] = useState<Record<string, BusRouteData> | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const inflightTrains = useRef<AbortController | null>(null);
  const inflightVehicles = useRef<AbortController | null>(null);

  const pullTrains = useCallback(async () => {
    inflightTrains.current?.abort();
    const ctl = new AbortController();
    inflightTrains.current = ctl;
    try {
      const r = await fetch("/api/trains", { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { generatedAt: string; trains: Train[] };
      setTrains(j.trains);
      setTrainsAt(j.generatedAt);
    } catch {}
  }, []);

  const pullVehicles = useCallback(async () => {
    inflightVehicles.current?.abort();
    const ctl = new AbortController();
    inflightVehicles.current = ctl;
    try {
      const r = await fetch("/api/vehicles", { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { vehicles: Vehicle[] };
      setVehicles(j.vehicles);
    } catch {}
  }, []);

  const pullAlerts = useCallback(async () => {
    try {
      const r = await fetch("/api/alerts", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { alerts: Alert[] };
      setAlerts(j.alerts);
    } catch {}
  }, []);

  const pullElevators = useCallback(async () => {
    try {
      const r = await fetch("/api/elevators", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { outages: ElevatorOutage[] };
      setElevators(j.outages);
    } catch {}
  }, []);

  useEffect(() => {
    pullTrains();
    const t = setInterval(pullTrains, TRAINS_POLL_MS);
    return () => clearInterval(t);
  }, [pullTrains]);

  useEffect(() => {
    pullVehicles();
    const t = setInterval(pullVehicles, VEHICLES_POLL_MS);
    return () => clearInterval(t);
  }, [pullVehicles]);

  useEffect(() => {
    pullAlerts();
    const t = setInterval(pullAlerts, ALERTS_POLL_MS);
    return () => clearInterval(t);
  }, [pullAlerts]);

  useEffect(() => {
    pullElevators();
    const t = setInterval(pullElevators, ELEVATORS_POLL_MS);
    return () => clearInterval(t);
  }, [pullElevators]);

  // Lazy-load the heavy bus shape/stops payload the first time a bus route is
  // enabled (and never if the user stays in rail-only mode).
  useEffect(() => {
    if (enabledBusRoutes.size === 0 || busData) return;
    loadBusData().then(setBusData).catch(() => {});
  }, [enabledBusRoutes, busData]);

  const visibleTrains = useMemo(
    () => trains.filter((t) => (t.lineId ? enabledLines.has(t.lineId) : true)),
    [trains, enabledLines],
  );

  const visibleVehicles = useMemo(
    () =>
      vehicles.filter((v) => {
        if (v.isBus) return v.routeId ? enabledBusRoutes.has(v.routeId) : false;
        return v.lineId ? enabledLines.has(v.lineId) : false;
      }),
    [vehicles, enabledLines, enabledBusRoutes],
  );

  const visibleStations = useMemo(
    () => stations.filter((s) => s.lineIds.some((id) => enabledLines.has(id))),
    [enabledLines],
  );

  const enabledBusData = useMemo(() => {
    if (!busData) return new Map<string, BusRouteData>();
    const out = new Map<string, BusRouteData>();
    for (const rid of enabledBusRoutes) {
      const d = busData[rid];
      if (d) out.set(rid, d);
    }
    return out;
  }, [busData, enabledBusRoutes]);

  const toggleLine = useCallback((id: string) => {
    setEnabledLines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAllLines = useCallback((on: boolean) => {
    setEnabledLines(on ? new Set(lines.map((l) => l.id)) : new Set());
  }, []);

  const setModeLines = useCallback((modes: string[], on: boolean) => {
    setEnabledLines((prev) => {
      const next = new Set(prev);
      for (const l of lines) {
        if (modes.includes(l.mode)) {
          if (on) next.add(l.id);
          else next.delete(l.id);
        }
      }
      return next;
    });
  }, []);

  const toggleBusRoute = useCallback((id: string) => {
    setEnabledBusRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearBusRoutes = useCallback(() => setEnabledBusRoutes(new Set()), []);

  const [sheetState, setSheetState] = useState<"peek" | "half" | "full">("peek");
  const cycleSheet = useCallback(
    () =>
      setSheetState((s) => (s === "peek" ? "half" : s === "half" ? "full" : "peek")),
    [],
  );

  // Auto-pop the bottom sheet open whenever the user picks something so the
  // detail panel isn't hidden behind a 64px peek strip on phones.
  useEffect(() => {
    if (selection) setSheetState((s) => (s === "peek" ? "half" : s));
  }, [selection]);

  const sheetHeightClass =
    sheetState === "peek"
      ? "h-16"
      : sheetState === "half"
        ? "h-[60vh]"
        : "h-[calc(100%-1rem)]";

  return (
    <div className="h-full w-full flex flex-col">
      <AlertsBar alerts={alerts} elevators={elevators} />
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">
        <div className="flex-1 relative min-h-0">
          <MapView
            trains={visibleTrains}
            vehicles={visibleVehicles}
            stations={visibleStations}
            enabledLines={enabledLines}
            busData={enabledBusData}
            selection={selection}
            onSelect={setSelection}
          />
          <Legend
            trainsAt={trainsAt}
            trainCount={visibleTrains.length}
            trainTotal={trains.length}
            vehicleCount={visibleVehicles.length}
            busRouteCount={enabledBusRoutes.size}
          />
        </div>

        {/* Sidebar/bottom-sheet wrapper. On desktop it's a fixed-width right
            column; on mobile it floats over the map and the user can cycle
            its height with the handle button. */}
        <div
          className={`
            absolute inset-x-0 bottom-0 z-[500] flex flex-col bg-panel
            border-t border-panel-border shadow-[0_-8px_24px_rgba(0,0,0,0.4)]
            transition-[height] duration-200 ease-out
            md:static md:w-[380px] md:h-full md:border-t-0 md:border-l md:shadow-none
            ${sheetHeightClass}
          `}
        >
          <button
            onClick={cycleSheet}
            className="md:hidden w-full py-2 px-4 text-left flex items-center justify-between border-b border-panel-border"
            aria-label={`Bottom sheet (${sheetState}) — tap to expand`}
          >
            <span className="flex flex-col gap-1.5">
              <span className="h-1 w-10 rounded-full bg-muted/40 self-center" />
            </span>
            <span className="text-xs font-mono text-muted">
              {sheetState === "peek" ? "tap to expand" : sheetState === "half" ? "expand" : "collapse"}
            </span>
          </button>

          <div className="flex-1 min-h-0 overflow-hidden">
            <Sidebar
              trains={trains}
              vehicles={vehicles}
              enabledLines={enabledLines}
              enabledBusRoutes={enabledBusRoutes}
              onToggleLine={toggleLine}
              onSetAllLines={setAllLines}
              onSetModeLines={setModeLines}
              onToggleBusRoute={toggleBusRoute}
              onClearBusRoutes={clearBusRoutes}
              selection={selection}
              onSelect={setSelection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({
  trainsAt,
  trainCount,
  trainTotal,
  vehicleCount,
  busRouteCount,
}: {
  trainsAt: string | null;
  trainCount: number;
  trainTotal: number;
  vehicleCount: number;
  busRouteCount: number;
}) {
  const stamp = trainsAt ? new Date(trainsAt).toLocaleTimeString() : "—";
  return (
    <div className="absolute bottom-3 left-3 z-[400] bg-panel/90 border border-panel-border rounded-md px-3 py-2 text-xs font-mono space-y-1 backdrop-blur">
      <div className="text-muted">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-2 align-middle" />
        live · updated {stamp}
      </div>
      <div className="text-muted">
        RR: {trainCount}/{trainTotal} · transit: {vehicleCount}
        {busRouteCount > 0 && ` · ${busRouteCount} bus routes`}
      </div>
      <div className="flex items-center gap-3 pt-1 border-t border-panel-border mt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> on time
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full ring-1 ring-red-500" /> late
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full ring-2 ring-red-600" /> 10+
        </span>
      </div>
    </div>
  );
}
