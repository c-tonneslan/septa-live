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

  return (
    <div className="h-full w-full flex flex-col">
      <AlertsBar alerts={alerts} elevators={elevators} />
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_380px] min-h-0">
        <div className="relative min-h-0">
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
