"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import AlertsBar from "./AlertsBar";
import type { Train, Alert } from "@/lib/septa";
import { lines } from "@/data/lines";
import { stations } from "@/data/stations";

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
  | { kind: "station"; id: string }
  | null;

const TRAINS_POLL_MS = 15_000;
const ALERTS_POLL_MS = 60_000;

export default function App() {
  const [trains, setTrains] = useState<Train[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trainsAt, setTrainsAt] = useState<string | null>(null);
  const [enabledLines, setEnabledLines] = useState<Set<string>>(
    () => new Set(lines.map((l) => l.id)),
  );
  const [selection, setSelection] = useState<Selection>(null);
  const inflightTrains = useRef<AbortController | null>(null);

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
    } catch {
      // aborted or network error; the next tick will retry
    }
  }, []);

  const pullAlerts = useCallback(async () => {
    try {
      const r = await fetch("/api/alerts", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { alerts: Alert[] };
      setAlerts(j.alerts);
    } catch {
      // ignore; alerts refresh on the next tick
    }
  }, []);

  useEffect(() => {
    pullTrains();
    const t = setInterval(pullTrains, TRAINS_POLL_MS);
    return () => clearInterval(t);
  }, [pullTrains]);

  useEffect(() => {
    pullAlerts();
    const t = setInterval(pullAlerts, ALERTS_POLL_MS);
    return () => clearInterval(t);
  }, [pullAlerts]);

  const visibleTrains = useMemo(
    () => trains.filter((t) => (t.lineId ? enabledLines.has(t.lineId) : true)),
    [trains, enabledLines],
  );

  const visibleStations = useMemo(
    () => stations.filter((s) => s.lineIds.some((id) => enabledLines.has(id))),
    [enabledLines],
  );

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

  return (
    <div className="h-full w-full flex flex-col">
      <AlertsBar alerts={alerts} />
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_360px] min-h-0">
        <div className="relative min-h-0">
          <MapView
            trains={visibleTrains}
            stations={visibleStations}
            selection={selection}
            onSelect={setSelection}
          />
          <Legend trainsAt={trainsAt} count={visibleTrains.length} total={trains.length} />
        </div>
        <Sidebar
          trains={trains}
          enabledLines={enabledLines}
          onToggleLine={toggleLine}
          onSetAllLines={setAllLines}
          selection={selection}
          onSelect={setSelection}
        />
      </div>
    </div>
  );
}

function Legend({
  trainsAt,
  count,
  total,
}: {
  trainsAt: string | null;
  count: number;
  total: number;
}) {
  const stamp = trainsAt ? new Date(trainsAt).toLocaleTimeString() : "—";
  return (
    <div className="absolute bottom-3 left-3 z-[400] bg-panel/90 border border-panel-border rounded-md px-3 py-2 text-xs font-mono space-y-1 backdrop-blur">
      <div className="text-muted">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-2 align-middle" />
        live · updated {stamp}
      </div>
      <div className="text-muted">
        {count}/{total} trains visible
      </div>
      <div className="flex items-center gap-3 pt-1 border-t border-panel-border mt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> on time
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full ring-1 ring-red-500" /> late
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full ring-2 ring-red-600" /> 10+ min
        </span>
      </div>
    </div>
  );
}
