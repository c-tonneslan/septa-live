"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import AlertsBar from "./AlertsBar";
import type { Train, Vehicle, Alert, ElevatorOutage } from "@/lib/septa";
import { lines } from "@/data/lines";
import { stations } from "@/data/stations";
import { loadBusData, type BusRouteData } from "@/data/buses";
import type { Trip } from "@/lib/router";
import { loadPrefs, savePrefs, clearPrefs } from "@/lib/prefs";
import { parseView, encodeView, isStaleShare, type ParsedView } from "@/lib/shareState";
import ShareButton from "./ShareButton";

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
  // Client-side timestamp of the last successful trains fetch. Drives the
  // "stale" / "API down" indicator in the legend when SEPTA's feed
  // stops responding mid-session.
  const [trainsFetchedAt, setTrainsFetchedAt] = useState<number | null>(null);
  const [enabledLines, setEnabledLines] = useState<Set<string>>(
    () => new Set(lines.map((l) => l.id)),
  );
  const [enabledBusRoutes, setEnabledBusRoutes] = useState<Set<string>>(() => new Set());
  // Lines/routes turned on transiently by selecting a hidden unit — they feed
  // visibility but are NOT persisted, so a one-off tap on the "worst delays"
  // list doesn't silently rewrite the rider's saved filter.
  const [pinnedLines, setPinnedLines] = useState<Set<string>>(() => new Set());
  const [pinnedBusRoutes, setPinnedBusRoutes] = useState<Set<string>>(() => new Set());
  const [busData, setBusData] = useState<Record<string, BusRouteData> | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const inflightTrains = useRef<AbortController | null>(null);
  const inflightVehicles = useRef<AbortController | null>(null);

  // Camera only feeds MapView (which is ssr:false), so it's safe to read the URL
  // synchronously here — no SSR hydration surface. Filter state below must NOT.
  const initialCamera = useMemo(
    () => (typeof window === "undefined" ? null : parseView(window.location.search).camera),
    [],
  );
  const [camera, setCamera] = useState(initialCamera);

  // Resolve initial filter state with a single precedence: URL (explicit share)
  // > localStorage (ambient pref) > all-on default. Hydrate AFTER mount so the
  // server-rendered Sidebar/Legend don't hydration-mismatch. Stash the shared
  // selection to resolve once live data arrives.
  const [hydrated, setHydrated] = useState(false);
  const [shareResolved, setShareResolved] = useState(false);
  const justHydrated = useRef(true);
  const restoredSel = useRef<ParsedView["selection"]>(null);
  const restoredSelFresh = useRef(false); // train/vehicle sel trustable (has a fresh `t`)
  useEffect(() => {
    const view = parseView(window.location.search);
    // A share link carries a camera or a selection. For those, a missing lines=/
    // bus= means "the sharer had all lines on / no buses" (encodeView omits the
    // default) — NOT "fall back to the recipient's saved prefs".
    const isShare = view.camera !== null || view.selection !== null;
    const prefs = !isShare && (view.lines === null || view.bus === null) ? loadPrefs() : null;
    if (view.lines !== null) setEnabledLines(new Set(view.lines));
    else if (prefs) setEnabledLines(new Set(prefs.lines));
    if (view.bus !== null) setEnabledBusRoutes(new Set(view.bus));
    else if (prefs) setEnabledBusRoutes(new Set(prefs.bus));
    restoredSel.current = view.selection;
    // A train/vehicle selection is only trustable with a fresh timestamp: an
    // address-bar/bookmark URL has no `t`, and a next-day link's train number is
    // reused. Stations are static and always resolve regardless.
    restoredSelFresh.current = view.t !== null && !isStaleShare(view.t);
    setHydrated(true);
  }, []);

  // Debounced camera capture from the map's moveend/zoomend.
  const camTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleViewChange = useCallback((center: [number, number], zoom: number) => {
    if (camTimer.current) clearTimeout(camTimer.current);
    camTimer.current = setTimeout(() => setCamera({ center, zoom }), 400);
  }, []);
  // Write only after a genuine post-hydration change — skipping the hydration
  // tick avoids both clobbering saved prefs and freezing the all-on default into
  // storage for first-time visitors who never touched a filter.
  useEffect(() => {
    if (!hydrated) return;
    if (justHydrated.current) { justHydrated.current = false; return; }
    savePrefs({ lines: Array.from(enabledLines), bus: Array.from(enabledBusRoutes) });
  }, [hydrated, enabledLines, enabledBusRoutes]);

  // Keep the URL in sync with the view (no `t` — that only stamps on an explicit
  // Share). replaceState + a diff so panning doesn't spam history or the URL.
  const lastUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    // Until the shared selection resolves (post-first-poll), keep encoding the
    // pending restored sel so a Share — or the address bar — during the load
    // window doesn't drop it. Once resolved, `selection` (or null if dropped) wins.
    const pendingSel = selection
      ? { kind: selection.kind, id: selection.id }
      : shareResolved ? null : restoredSel.current;
    const search = encodeView({
      lines: Array.from(enabledLines),
      bus: Array.from(enabledBusRoutes),
      selection: pendingSel,
      camera,
    });
    const url = window.location.pathname + search;
    if (url !== lastUrl.current) {
      lastUrl.current = url;
      window.history.replaceState(null, "", url);
    }
  }, [hydrated, enabledLines, enabledBusRoutes, selection, camera, shareResolved]);

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
      setTrainsFetchedAt(Date.now());
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

  // Visibility = the persisted filter plus any transiently-pinned lines/routes.
  const lineOn = useCallback(
    (id: string) => enabledLines.has(id) || pinnedLines.has(id),
    [enabledLines, pinnedLines],
  );
  const busOn = useCallback(
    (id: string) => enabledBusRoutes.has(id) || pinnedBusRoutes.has(id),
    [enabledBusRoutes, pinnedBusRoutes],
  );

  const visibleTrains = useMemo(
    () => trains.filter((t) => (t.lineId ? lineOn(t.lineId) : true)),
    [trains, lineOn],
  );

  const visibleVehicles = useMemo(
    () =>
      vehicles.filter((v) => {
        if (v.isBus) return v.routeId ? busOn(v.routeId) : false;
        return v.lineId ? lineOn(v.lineId) : false;
      }),
    [vehicles, lineOn, busOn],
  );

  const visibleStations = useMemo(
    () => stations.filter((s) => s.lineIds.some((id) => lineOn(id))),
    [lineOn],
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

  const resetPrefs = useCallback(() => {
    // Skip the write the reset itself triggers, so the key is removed rather
    // than immediately repopulated with defaults.
    justHydrated.current = true;
    setEnabledLines(new Set(lines.map((l) => l.id)));
    setEnabledBusRoutes(new Set());
    clearPrefs();
  }, []);

  // The sidebar's "worst delays" list is built from the FULL data, but the map
  // only renders enabled lines/routes. Selecting a unit whose line is filtered
  // off would leave the map with no marker to fly to or highlight — so PIN its
  // line so it shows. Pins feed visibility but are not persisted, so a one-off
  // tap doesn't permanently rewrite the rider's saved filter.
  const handleSelect = useCallback((s: Selection) => {
    if (s?.kind === "train") {
      const t = trains.find((x) => x.id === s.id);
      if (t?.lineId && !enabledLines.has(t.lineId)) {
        const id = t.lineId;
        setPinnedLines((prev) => new Set(prev).add(id));
      }
    } else if (s?.kind === "vehicle") {
      const v = vehicles.find((x) => x.id === s.id);
      if (v?.isBus && v.routeId && !enabledBusRoutes.has(v.routeId)) {
        const id = v.routeId;
        setPinnedBusRoutes((prev) => new Set(prev).add(id));
      } else if (v && !v.isBus && v.lineId && !enabledLines.has(v.lineId)) {
        const id = v.lineId;
        setPinnedLines((prev) => new Set(prev).add(id));
      }
    }
    setSelection(s);
  }, [trains, vehicles, enabledLines, enabledBusRoutes]);

  // Resolve a shared selection. Stations resolve immediately (static data);
  // train/vehicle wait for the first poll, then degrade gracefully — an untrusted
  // (no/stale `t`) share or a unit no longer in the feed is dropped silently,
  // leaving the durable camera+lines. handleSelect pins the unit's line so it shows.
  useEffect(() => {
    if (shareResolved) return;
    const sel = restoredSel.current;
    if (!sel) { setShareResolved(true); return; }
    // Stations don't depend on live vehicle data — never gate them on the feed.
    if (sel.kind === "station") { setShareResolved(true); handleSelect(sel); return; }
    if (trains.length === 0 && vehicles.length === 0) return; // wait for the first poll
    setShareResolved(true);
    if (!restoredSelFresh.current) return; // no/stale timestamp — don't chase a wrong unit
    if (sel.kind === "train" && trains.some((t) => t.id === sel.id)) handleSelect(sel);
    else if (sel.kind === "vehicle" && vehicles.some((v) => v.id === sel.id)) handleSelect(sel);
  }, [shareResolved, trains, vehicles, handleSelect]);

  // The full shareable URL (with a `t` stamp so a stale selection can be dropped).
  const buildShareUrl = useCallback(() => {
    // Same pending-selection logic as the writer, so sharing during the load
    // window still carries the shared selection.
    const sel = selection
      ? { kind: selection.kind, id: selection.id }
      : shareResolved ? null : restoredSel.current;
    const search = encodeView(
      {
        lines: Array.from(enabledLines),
        bus: Array.from(enabledBusRoutes),
        selection: sel,
        camera,
      },
      { withTimestamp: true },
    );
    return window.location.origin + window.location.pathname + search;
  }, [enabledLines, enabledBusRoutes, selection, camera, shareResolved]);

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

  // Esc deselects whatever's currently selected. Skip while the user's
  // typing in a station/stop picker so it can dismiss the suggestion
  // dropdown natively.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (selection) setSelection(null);
      else if (trip) setTrip(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, trip]);

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
            trip={trip}
            selection={selection}
            onSelect={handleSelect}
            initialCamera={initialCamera}
            onViewChange={handleViewChange}
          />
          <Legend
            trainsAt={trainsAt}
            trainsFetchedAt={trainsFetchedAt}
            trainCount={visibleTrains.length}
            trainTotal={trains.length}
            vehicleCount={visibleVehicles.length}
            busRouteCount={enabledBusRoutes.size}
          />
          <ShareButton getUrl={buildShareUrl} />
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
              onShowTrip={setTrip}
              onResetPrefs={resetPrefs}
              selection={selection}
              onSelect={handleSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Trains poll every 15s. Anything older than 60s of client wall-clock is
// "stale" (one or two failed pulls), past 3 minutes the feed is treated
// as down. The legend re-evaluates every 5s so the badge updates even
// when no new data arrives.
const STALE_AFTER_MS = 60_000;
const DOWN_AFTER_MS = 180_000;
const LEGEND_TICK_MS = 5_000;

function Legend({
  trainsAt,
  trainsFetchedAt,
  trainCount,
  trainTotal,
  vehicleCount,
  busRouteCount,
}: {
  trainsAt: string | null;
  trainsFetchedAt: number | null;
  trainCount: number;
  trainTotal: number;
  vehicleCount: number;
  busRouteCount: number;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), LEGEND_TICK_MS);
    return () => clearInterval(t);
  }, []);

  const stamp = trainsAt ? new Date(trainsAt).toLocaleTimeString() : "—";
  const age = trainsFetchedAt ? Date.now() - trainsFetchedAt : null;
  const status: "live" | "stale" | "down" =
    age === null || age < STALE_AFTER_MS
      ? "live"
      : age < DOWN_AFTER_MS
        ? "stale"
        : "down";
  const dotClass =
    status === "live"
      ? "bg-emerald-400 animate-pulse"
      : status === "stale"
        ? "bg-amber-400"
        : "bg-red-500";
  const statusText =
    status === "live"
      ? `live · updated ${stamp}`
      : status === "stale"
        ? `stale · last update ${stamp}`
        : `SEPTA feed unreachable · last update ${stamp}`;

  return (
    <div className="absolute bottom-3 left-3 z-[400] bg-panel/90 border border-panel-border rounded-md px-3 py-2 text-xs font-mono space-y-1 backdrop-blur">
      <div className="text-muted">
        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle ${dotClass}`} />
        {statusText}
      </div>
      <div className="text-muted">
        RR: {trainCount}/{trainTotal} · transit: {vehicleCount}
        {busRouteCount > 0 && ` · ${busRouteCount} bus routes`}
      </div>
      <div className="pt-1 border-t border-panel-border mt-1 space-y-1">
        {/* Delay is a RING around the (line-colored) marker, not its fill —
            no ring = on time, amber = 3–9 min, red = 10+ min. */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-muted" /> on time
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-muted ring-2 ring-late" /> 3–9m
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-muted ring-2 ring-late-severe" /> 10m+
          </span>
        </div>
        <div className="text-muted/80">pill = train · dot = bus/trolley · ring = station</div>
        <div className="text-muted/70">tap any marker for live detail</div>
      </div>
    </div>
  );
}
