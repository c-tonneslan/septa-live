"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Train, Vehicle } from "@/lib/septa";
import { lines as allLines } from "@/data/lines";
import { stations } from "@/data/stations";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const POLL_MS = 15_000;

interface Props {
  // Optional comma-separated list of line IDs (e.g. "PAO,TRE,WIL") to limit
  // the map to. When unset, every line is shown.
  lineFilter?: string[] | null;
}

export default function EmbedMap({ lineFilter }: Props) {
  const [trains, setTrains] = useState<Train[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const inflightTrains = useRef<AbortController | null>(null);
  const inflightVehicles = useRef<AbortController | null>(null);

  const enabledLines = useMemo(() => {
    if (!lineFilter || lineFilter.length === 0) return new Set(allLines.map((l) => l.id));
    return new Set(lineFilter);
  }, [lineFilter]);

  const pullTrains = useCallback(async () => {
    inflightTrains.current?.abort();
    const ctl = new AbortController();
    inflightTrains.current = ctl;
    try {
      const r = await fetch("/api/trains", { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { trains: Train[] };
      setTrains(j.trains);
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

  useEffect(() => {
    pullTrains();
    const t = setInterval(pullTrains, POLL_MS);
    return () => clearInterval(t);
  }, [pullTrains]);

  useEffect(() => {
    pullVehicles();
    const t = setInterval(pullVehicles, POLL_MS);
    return () => clearInterval(t);
  }, [pullVehicles]);

  const visibleTrains = useMemo(
    () => trains.filter((t) => (t.lineId ? enabledLines.has(t.lineId) : true)),
    [trains, enabledLines],
  );
  const visibleVehicles = useMemo(
    () => vehicles.filter((v) => v.lineId && enabledLines.has(v.lineId)),
    [vehicles, enabledLines],
  );
  const visibleStations = useMemo(
    () => stations.filter((s) => s.lineIds.some((id) => enabledLines.has(id))),
    [enabledLines],
  );

  return (
    <div className="h-screen w-screen">
      <MapView
        trains={visibleTrains}
        vehicles={visibleVehicles}
        stations={visibleStations}
        enabledLines={enabledLines}
        busData={new Map()}
        trip={null}
        selection={null}
        onSelect={() => {}}
      />
    </div>
  );
}
