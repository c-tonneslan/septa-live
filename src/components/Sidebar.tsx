"use client";

import { useEffect, useMemo, useState } from "react";
import { lines, type Mode } from "@/data/lines";
import { stations, lookupStation } from "@/data/stations";
import { busRoutes, lookupBusRoute } from "@/data/buses";
import { loadNetwork, route as runRoute, type Trip, type NetworkStop } from "@/lib/router";
import type { Train, Vehicle, StationArrivals } from "@/lib/septa";
import { lateStatus } from "@/lib/delay";
import type { Selection } from "./App";

interface Props {
  trains: Train[];
  vehicles: Vehicle[];
  enabledLines: Set<string>;
  enabledBusRoutes: Set<string>;
  onToggleLine: (id: string) => void;
  onSetAllLines: (on: boolean) => void;
  onSetModeLines: (modes: Mode[], on: boolean) => void;
  onToggleBusRoute: (id: string) => void;
  onClearBusRoutes: () => void;
  onShowTrip: (trip: Trip | null) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
}

const MODE_GROUPS: { label: string; modes: Mode[] }[] = [
  { label: "Regional Rail", modes: ["rr"] },
  { label: "Subway & Light Rail", modes: ["bsl", "mfl", "nhsl"] },
  { label: "Trolley", modes: ["trolley", "girard", "suburban-trolley"] },
];

export default function Sidebar({
  trains,
  vehicles,
  enabledLines,
  enabledBusRoutes,
  onToggleLine,
  onSetAllLines,
  onSetModeLines,
  onToggleBusRoute,
  onClearBusRoutes,
  onShowTrip,
  selection,
  onSelect,
}: Props) {
  return (
    <aside className="bg-panel h-full min-h-0 flex flex-col">
      <header className="px-4 py-3 border-b border-panel-border">
        <h1 className="text-base font-bold tracking-tight">SEPTA Live</h1>
        <p className="text-xs text-muted mt-0.5">
          Regional Rail, Subway, Trolley
        </p>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {selection && (
          <DetailPanel
            selection={selection}
            trains={trains}
            vehicles={vehicles}
            onClose={() => onSelect(null)}
          />
        )}
        {/* LinePanel stays MOUNTED (just hidden) while a detail panel is open, so
            an in-progress trip plan, bus search, and station query survive a
            marker selection instead of being destroyed by an unmount. */}
        <div className={selection ? "hidden" : ""}>
          <LinePanel
            trains={trains}
            vehicles={vehicles}
            enabledLines={enabledLines}
            enabledBusRoutes={enabledBusRoutes}
            onToggleLine={onToggleLine}
            onSetAllLines={onSetAllLines}
            onSetModeLines={onSetModeLines}
            onToggleBusRoute={onToggleBusRoute}
            onClearBusRoutes={onClearBusRoutes}
            onShowTrip={onShowTrip}
            onSelect={onSelect}
          />
        </div>
      </div>
    </aside>
  );
}

function LinePanel({
  trains,
  vehicles,
  enabledLines,
  enabledBusRoutes,
  onToggleLine,
  onSetAllLines,
  onSetModeLines,
  onToggleBusRoute,
  onClearBusRoutes,
  onShowTrip,
  onSelect,
}: {
  trains: Train[];
  vehicles: Vehicle[];
  enabledLines: Set<string>;
  enabledBusRoutes: Set<string>;
  onToggleLine: (id: string) => void;
  onSetAllLines: (on: boolean) => void;
  onSetModeLines: (modes: Mode[], on: boolean) => void;
  onToggleBusRoute: (id: string) => void;
  onClearBusRoutes: () => void;
  onShowTrip: (trip: Trip | null) => void;
  onSelect: (s: Selection) => void;
}) {
  const countsByLine = useMemo(() => {
    const m = new Map<string, { total: number; late: number }>();
    const bump = (lineId: string, late: number) => {
      const c = m.get(lineId) ?? { total: 0, late: 0 };
      c.total += 1;
      if (late >= 3) c.late += 1;
      m.set(lineId, c);
    };
    for (const t of trains) if (t.lineId) bump(t.lineId, t.lateMinutes);
    for (const v of vehicles) if (v.lineId) bump(v.lineId, v.lateMinutes);
    return m;
  }, [trains, vehicles]);

  const totalLate =
    trains.filter((t) => t.lateMinutes >= 3).length +
    vehicles.filter((v) => v.lateMinutes >= 3).length;

  const worst = useMemo(() => {
    type Worst = { id: string; kind: "train" | "vehicle"; lineColor: string; lineShort: string | null; destination: string; lateMinutes: number };
    const out: Worst[] = [];
    for (const t of trains)
      if (t.lateMinutes > 0)
        out.push({ id: t.id, kind: "train", lineColor: t.lineColor, lineShort: t.lineShort, destination: t.destination, lateMinutes: t.lateMinutes });
    for (const v of vehicles)
      if (v.lateMinutes > 0)
        out.push({ id: v.id, kind: "vehicle", lineColor: v.lineColor, lineShort: v.lineShort, destination: v.destination, lateMinutes: v.lateMinutes });
    return out.sort((a, b) => b.lateMinutes - a.lateMinutes).slice(0, 6);
  }, [trains, vehicles]);

  return (
    <div className="p-4 space-y-5">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-widest text-muted">System</h2>
          <div className="text-xs text-muted font-mono">
            {trains.length + vehicles.length} units · {totalLate} late
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onSetAllLines(true)}
            className="text-xs py-1.5 rounded border border-panel-border hover:bg-panel-border/40"
          >
            show all
          </button>
          <button
            onClick={() => onSetAllLines(false)}
            className="text-xs py-1.5 rounded border border-panel-border hover:bg-panel-border/40"
          >
            hide all
          </button>
        </div>
      </section>

      {/* The two primary rider tasks, promoted above the line filters. */}
      <TripPlanner onShowTrip={onShowTrip} />

      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted mb-2">Find a station</h2>
        <StationPicker onPick={(id) => onSelect({ kind: "station", id })} />
      </section>

      {MODE_GROUPS.map((group) => {
        const linesInGroup = lines.filter((l) => group.modes.includes(l.mode));
        if (linesInGroup.length === 0) return null;
        const anyOn = linesInGroup.some((l) => enabledLines.has(l.id));
        return (
          <section key={group.label}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs uppercase tracking-widest text-muted">{group.label}</h2>
              <button
                onClick={() => onSetModeLines(group.modes, !anyOn)}
                aria-label={`${anyOn ? "Hide" : "Show"} all ${group.label}`}
                className="text-[10px] font-mono text-muted hover:text-foreground p-2 -m-2"
              >
                {anyOn ? "hide" : "show"}
              </button>
            </div>
            <ul className="space-y-0.5">
              {linesInGroup.map((l) => {
                const counts = countsByLine.get(l.id);
                const enabled = enabledLines.has(l.id);
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => onToggleLine(l.id)}
                      aria-pressed={enabled}
                      aria-label={`${l.name}${counts ? `, ${counts.total} active, ${counts.late} late` : ""}`}
                      className={`w-full flex items-center gap-2.5 px-2 py-2 md:py-1.5 rounded text-left text-sm transition-colors ${
                        enabled ? "hover:bg-panel-border/40" : "opacity-40 hover:opacity-70"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ background: l.color }}
                        aria-hidden
                      />
                      <span className="flex-1 truncate">{l.name}</span>
                      <span className="text-xs font-mono text-muted">
                        {counts ? counts.total : "—"}
                        {counts && counts.late > 0 && (
                          <span className="text-late-severe ml-1">·{counts.late}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {worst.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-muted mb-2">Most delayed</h2>
          <ul className="space-y-1">
            {worst.map((w) => (
              <li key={`${w.kind}-${w.id}`}>
                <button
                  onClick={() => onSelect({ kind: w.kind, id: w.id })}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm hover:bg-panel-border/40"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: w.lineColor }} />
                  <span className="font-mono text-xs w-14 truncate">{w.lineShort ?? ""} {w.id.split("-").pop()}</span>
                  <span className="flex-1 truncate text-muted">→ {w.destination}</span>
                  <span className={`font-mono text-xs ${lateStatus(w.lateMinutes).textClass}`}>+{w.lateMinutes}m</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BusPanel
        vehicles={vehicles}
        enabledBusRoutes={enabledBusRoutes}
        onToggleBusRoute={onToggleBusRoute}
        onClearBusRoutes={onClearBusRoutes}
      />
    </div>
  );
}

function TripPlanner({
  onShowTrip,
}: {
  onShowTrip: (trip: Trip | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [graphState, setGraphState] = useState<{
    stops: NetworkStop[];
    graph: Parameters<typeof runRoute>[0];
  } | null>(null);
  const [graphErr, setGraphErr] = useState<string | null>(null);

  const [originId, setOriginId] = useState<string | null>(null);
  const [destId, setDestId] = useState<string | null>(null);
  const [originQ, setOriginQ] = useState("");
  const [destQ, setDestQ] = useState("");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Lazy-load the ~1.8MB network graph the first time the panel opens.
  useEffect(() => {
    if (!open || graphState || graphErr) return;
    loadNetwork()
      .then(({ network, graph }) => setGraphState({ stops: network.stops, graph }))
      .catch(() => setGraphErr("Couldn't load the SEPTA network graph."));
  }, [open, graphState, graphErr]);

  const findRoute = () => {
    if (!graphState || !originId || !destId) return;
    setErr(null);
    const result = runRoute(graphState.graph, originId, destId);
    if (!result) {
      setErr("No route found.");
      onShowTrip(null);
      setTrip(null);
      return;
    }
    setTrip(result);
    onShowTrip(result);
  };

  const clear = () => {
    setTrip(null);
    onShowTrip(null);
    setOriginId(null);
    setDestId(null);
    setOriginQ("");
    setDestQ("");
  };

  return (
    <section>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-2 rounded border border-accent/40 text-sm font-medium text-foreground hover:bg-panel-hover hover:border-accent transition-colors"
        >
          Plan a trip →
        </button>
      ) : (
        <>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-widest text-muted">Trip planner</h2>
          <div className="flex items-center gap-2">
            {trip && (
              <button onClick={clear} className="text-[10px] font-mono text-muted hover:text-foreground">
                clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-[10px] font-mono text-muted hover:text-foreground"
            >
              hide
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {!graphState && !graphErr && (
            <div className="text-xs text-muted">Loading SEPTA network…</div>
          )}
          {graphErr && <div className="text-xs text-red-400">{graphErr}</div>}
          {graphState && (
            <>
              <StopPicker
                placeholder="From: any stop"
                stops={graphState.stops}
                value={originQ}
                onChange={(q, id) => {
                  setOriginQ(q);
                  setOriginId(id);
                }}
              />
              <StopPicker
                placeholder="To: any stop"
                stops={graphState.stops}
                value={destQ}
                onChange={(q, id) => {
                  setDestQ(q);
                  setDestId(id);
                }}
              />
              <button
                onClick={findRoute}
                disabled={!originId || !destId}
                className="w-full text-sm py-1.5 rounded border border-panel-border hover:bg-panel-border/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Find route
              </button>
              {err && <div className="text-xs text-red-400">{err}</div>}
              {trip && <TripDisplay trip={trip} />}
            </>
          )}
        </div>
        </>
      )}
    </section>
  );
}

function StopPicker({
  placeholder,
  stops,
  value,
  onChange,
}: {
  placeholder: string;
  stops: NetworkStop[];
  value: string;
  onChange: (q: string, id: string | null) => void;
}) {
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    return stops
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [stops, value]);

  return (
    <div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-background border border-panel-border rounded px-2 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
      />
      {filtered.length > 0 && (
        <ul className="mt-1 border border-panel-border rounded divide-y divide-panel-border max-h-48 overflow-y-auto scrollbar-thin">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onChange(s.name, s.id)}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-panel-border/40 flex items-center gap-2"
              >
                <span className="font-mono text-[9px] text-muted w-16 truncate">
                  {s.modes.join(",")}
                </span>
                <span className="flex-1 truncate">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TripDisplay({ trip }: { trip: Trip }) {
  // Wall-clock estimates from now. The router uses distance/speed, not live
  // timetables, so label them as estimates rather than implying a schedule.
  const now = new Date();
  const at = (mins: number) =>
    new Date(now.getTime() + mins * 60_000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  let acc = 0;
  const legStart = trip.legs.map((leg) => {
    const s = acc;
    acc += leg.minutes;
    return s;
  });

  return (
    <div className="border border-panel-border rounded p-2.5 bg-background/40 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold">{Math.round(trip.totalMinutes)} min</span>
        <span className="text-xs text-muted font-mono">
          {trip.transfers} transfer{trip.transfers === 1 ? "" : "s"}
        </span>
      </div>
      <div className="text-xs text-muted">
        leave {at(0)} → arrive {at(trip.totalMinutes)}{" "}
        <span className="text-muted/60">· est.</span>
      </div>
      <ol className="space-y-1.5">
        {trip.legs.map((leg, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            {leg.kind === "walk" ? (
              <>
                <span className="w-3 h-3 rounded-full shrink-0 bg-muted/40 mt-0.5" />
                <div className="flex-1">
                  <div className="text-muted">Walk {Math.round(leg.minutes)} min</div>
                  <div className="text-muted/70 truncate">→ {leg.toStop.name}</div>
                </div>
              </>
            ) : (
              <>
                <span
                  className="w-3 h-3 rounded-sm shrink-0 mt-0.5"
                  style={{ background: leg.routeColor }}
                />
                <div className="flex-1">
                  <div>
                    <span className="font-mono text-[10px] bg-panel-border/60 px-1 rounded mr-1">
                      {leg.routeShort}
                    </span>
                    {leg.routeName}
                  </div>
                  <div className="text-muted">
                    board ~{at(legStart[i])} toward {leg.toStop.name}
                  </div>
                  <div className="text-muted/70">
                    {leg.fromStop.name} → {leg.toStop.name} ({Math.round(leg.minutes)} min)
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function BusPanel({
  vehicles,
  enabledBusRoutes,
  onToggleBusRoute,
  onClearBusRoutes,
}: {
  vehicles: Vehicle[];
  enabledBusRoutes: Set<string>;
  onToggleBusRoute: (id: string) => void;
  onClearBusRoutes: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const busesByRoute = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vehicles) {
      if (!v.isBus || !v.routeId) continue;
      m.set(v.routeId, (m.get(v.routeId) ?? 0) + 1);
    }
    return m;
  }, [vehicles]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return busRoutes.filter((r) => {
      if (!needle) return true;
      return (
        r.short.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle)
      );
    });
  }, [q]);

  const enabledList = useMemo(
    () => Array.from(enabledBusRoutes).map(lookupBusRoute).filter((r): r is NonNullable<typeof r> => r !== null),
    [enabledBusRoutes],
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Buses{" "}
          <span className="text-muted/60 font-mono normal-case tracking-normal">
            ({busRoutes.length})
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {enabledBusRoutes.size > 0 && (
            <button
              onClick={onClearBusRoutes}
              className="text-[10px] font-mono text-muted hover:text-foreground"
            >
              clear ({enabledBusRoutes.size})
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-[10px] font-mono text-muted hover:text-foreground"
          >
            {open ? "hide" : "show"}
          </button>
        </div>
      </div>

      {enabledList.length > 0 && (
        <ul className="space-y-0.5 mb-2">
          {enabledList.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onToggleBusRoute(r.id)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-sm bg-panel-border/30 hover:bg-panel-border/50"
              >
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: r.color }} />
                <span className="font-mono text-xs w-10">{r.short}</span>
                <span className="flex-1 truncate text-xs text-muted">{r.name}</span>
                <span className="font-mono text-xs text-muted">
                  {busesByRoute.get(r.id) ?? 0}
                </span>
                <span className="text-muted hover:text-foreground">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="33, City Hall, Frankford…"
            aria-label="Search bus routes"
            className="w-full bg-background border border-panel-border rounded px-2 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent mb-2"
          />
          <ul className="space-y-0.5 max-h-80 overflow-y-auto scrollbar-thin">
            {filtered.slice(0, 200).map((r) => {
              const enabled = enabledBusRoutes.has(r.id);
              const count = busesByRoute.get(r.id);
              return (
                <li key={r.id}>
                  <button
                    onClick={() => onToggleBusRoute(r.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-sm transition-colors ${
                      enabled ? "bg-panel-border/40" : "hover:bg-panel-border/30"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: r.color }} />
                    <span className="font-mono text-xs w-10">{r.short}</span>
                    <span className="flex-1 truncate text-xs text-muted">{r.name}</span>
                    {count !== undefined && count > 0 && (
                      <span className="font-mono text-[10px] text-emerald-300">{count}</span>
                    )}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="text-xs text-muted text-center py-2">no routes match</li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}

function StationPicker({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? stations
        .filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 8)
    : [];
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Suburban, Trenton, 30th, Girard…"
        aria-label="Search stations"
        className="w-full bg-background border border-panel-border rounded px-2 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
      />
      {filtered.length > 0 && (
        <ul className="mt-1 border border-panel-border rounded divide-y divide-panel-border">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => {
                  onPick(s.id);
                  setQ("");
                }}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-panel-border/40"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetailPanel({
  selection,
  trains,
  vehicles,
  onClose,
}: {
  selection: Selection;
  trains: Train[];
  vehicles: Vehicle[];
  onClose: () => void;
}) {
  if (!selection) return null;
  return (
    <div className="p-4 space-y-4">
      <button
        onClick={onClose}
        className="text-xs text-muted hover:text-foreground font-mono"
      >
        ← back to system
      </button>
      {selection.kind === "train" && (
        <TrainDetail train={trains.find((t) => t.id === selection.id) ?? null} />
      )}
      {selection.kind === "vehicle" && (
        <VehicleDetail vehicle={vehicles.find((v) => v.id === selection.id) ?? null} />
      )}
      {/* key remounts StationDetail when the station changes, so its cached
          `data` can't briefly show the previous station's arrivals. */}
      {selection.kind === "station" && <StationDetail key={selection.id} stationId={selection.id} />}
    </div>
  );
}

function TrainDetail({ train }: { train: Train | null }) {
  if (!train) {
    return <p className="text-sm text-muted">This train has dropped from the live feed.</p>;
  }
  const late = lateStatus(train.lateMinutes);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: train.lineColor }} />
        <span className="text-sm font-mono">{train.line}</span>
      </div>
      <div>
        <div className="text-xl font-bold">Train {train.id}</div>
        <div className="text-sm text-muted">{train.service} → {train.destination}</div>
      </div>
      <div className={`text-sm font-mono ${late.textClass}`}>{late.label}</div>
      <dl className="text-sm grid grid-cols-[7rem_1fr] gap-y-1.5">
        <dt className="text-muted">at</dt><dd>{train.currentStop || "—"}</dd>
        <dt className="text-muted">next stop</dt><dd>{train.nextStop || "—"}</dd>
        <dt className="text-muted">track</dt><dd>{train.track || "—"}</dd>
        <dt className="text-muted">origin</dt><dd>{train.source || "—"}</dd>
      </dl>
    </div>
  );
}

function VehicleDetail({ vehicle }: { vehicle: Vehicle | null }) {
  if (!vehicle) {
    return <p className="text-sm text-muted">This vehicle has dropped from the live feed.</p>;
  }
  const late = lateStatus(vehicle.lateMinutes);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: vehicle.lineColor }} />
        <span className="text-sm font-mono">{vehicle.lineShort ?? vehicle.rawRouteId}</span>
      </div>
      <div>
        <div className="text-xl font-bold">{vehicle.label}</div>
        <div className="text-sm text-muted">→ {vehicle.destination || "—"}</div>
      </div>
      <div className={`text-sm font-mono ${late.textClass}`}>{late.label}</div>
      <dl className="text-sm grid grid-cols-[7rem_1fr] gap-y-1.5">
        <dt className="text-muted">next stop</dt><dd>{vehicle.nextStop || "—"}</dd>
        <dt className="text-muted">trip</dt><dd className="font-mono text-xs">{vehicle.trip || "—"}</dd>
        <dt className="text-muted">route</dt><dd>{vehicle.rawRouteId}</dd>
      </dl>
    </div>
  );
}

function StationDetail({ stationId }: { stationId: string }) {
  const station = lookupStation(stationId);
  const [data, setData] = useState<StationArrivals | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!station) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch(`/api/arrivals?station=${encodeURIComponent(station.name)}&results=10`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: StationArrivals) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setErr("Couldn't load arrivals.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [station]);

  if (!station) return <p className="text-sm text-muted">Unknown station.</p>;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-bold">{station.name}</div>
        <div className="text-xs text-muted">
          {station.lineIds.length} line{station.lineIds.length === 1 ? "" : "s"}
        </div>
      </div>

      {loading && <div className="text-sm text-muted">Loading arrivals…</div>}
      {err && <div className="text-sm text-red-400">{err}</div>}

      {data && (
        <div className="space-y-4">
          {data.note && (
            <div className="text-xs text-muted border border-panel-border rounded px-2.5 py-2 bg-background/40">
              {data.note}
            </div>
          )}
          <ArrivalsList title="Northbound" arrivals={data.northbound} />
          <ArrivalsList title="Southbound" arrivals={data.southbound} />
          {!data.note && data.northbound.length === 0 && data.southbound.length === 0 && (
            <div className="text-sm text-muted">No upcoming arrivals reported.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ArrivalsList({
  title,
  arrivals,
}: {
  title: string;
  arrivals: StationArrivals["northbound"];
}) {
  if (arrivals.length === 0) return null;
  return (
    <section>
      <h3 className="text-xs uppercase tracking-widest text-muted mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {arrivals.map((a) => {
          // Parse the minutes out of the status string ("5 min late") so arrivals
          // use the same emerald/amber/red scale as everything else.
          const m = /(\d+)\s*min/i.exec(a.status);
          const mins = m && /late/i.test(a.status) ? Number(m[1]) : 0;
          const statusClass = lateStatus(mins).textClass;
          return (
            <li
              key={`${a.trainId}-${a.scheduledTime}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded border border-panel-border bg-background/40"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.lineColor }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">
                  <span className="font-mono text-xs text-muted mr-1.5">{a.trainId}</span>
                  → {a.destination}
                </div>
                <div className="text-xs text-muted truncate">
                  {a.line} · track {a.track || "?"} · platform {a.platform || "?"}
                </div>
              </div>
              <div className={`text-right text-sm font-mono shrink-0 ${statusClass}`}>
                {a.status}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
