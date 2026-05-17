"use client";

import { useEffect, useMemo, useState } from "react";
import { lines, type Mode } from "@/data/lines";
import { stations, lookupStation, hasRegionalRail } from "@/data/stations";
import { busRoutes, lookupBusRoute } from "@/data/buses";
import type { Train, Vehicle, StationArrivals, NextToArrive } from "@/lib/septa";
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
        {selection ? (
          <DetailPanel
            selection={selection}
            trains={trains}
            vehicles={vehicles}
            onClose={() => onSelect(null)}
          />
        ) : (
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
            onSelect={onSelect}
          />
        )}
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
                className="text-[10px] font-mono text-muted hover:text-foreground"
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
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left text-sm transition-colors ${
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
                          <span className="text-red-400 ml-1">·{counts.late}</span>
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
                  <span className="text-red-400 font-mono text-xs">+{w.lateMinutes}m</span>
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

      <TripPlanner />

      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted mb-2">Find a station</h2>
        <StationPicker onPick={(id) => onSelect({ kind: "station", id })} />
      </section>
    </div>
  );
}

function TripPlanner() {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<string>("");
  const [dest, setDest] = useState<string>("");
  const [trips, setTrips] = useState<NextToArrive[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rrStations = useMemo(
    () => stations.filter((s) => hasRegionalRail(s)).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const search = async () => {
    const o = lookupStation(origin);
    const d = lookupStation(dest);
    if (!o || !d) {
      setErr("Pick both stations from the list.");
      return;
    }
    setLoading(true);
    setErr(null);
    setTrips(null);
    try {
      const r = await fetch(
        `/api/next-to-arrive?origin=${encodeURIComponent(o.name)}&destination=${encodeURIComponent(d.name)}&results=6`,
        { cache: "no-store" },
      );
      if (!r.ok) throw new Error(`${r.status}`);
      const j = (await r.json()) as { trips: NextToArrive[] };
      setTrips(j.trips);
    } catch {
      setErr("Couldn't load trips.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">Trip planner</h2>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[10px] font-mono text-muted hover:text-foreground"
        >
          {open ? "hide" : "show"}
        </button>
      </div>
      {open && (
        <div className="space-y-2">
          <StationDatalist id="origin-list" stations={rrStations} />
          <StationDatalist id="dest-list" stations={rrStations} />
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            list="origin-list"
            placeholder="From: Suburban Station"
            className="w-full bg-background border border-panel-border rounded px-2 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-sky-500"
          />
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            list="dest-list"
            placeholder="To: Trenton"
            className="w-full bg-background border border-panel-border rounded px-2 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-sky-500"
          />
          <button
            onClick={search}
            disabled={loading || !origin || !dest}
            className="w-full text-sm py-1.5 rounded border border-panel-border hover:bg-panel-border/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Looking…" : "Next trains"}
          </button>
          {err && <div className="text-xs text-red-400">{err}</div>}
          {trips && trips.length === 0 && (
            <div className="text-xs text-muted">No upcoming trips found.</div>
          )}
          {trips && trips.length > 0 && (
            <ul className="space-y-2 pt-1">
              {trips.map((t, i) => (
                <li
                  key={i}
                  className="border border-panel-border rounded px-2.5 py-2 bg-background/40 space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.lineColor }} />
                    <span className="font-mono text-xs text-muted">{t.trainNumber}</span>
                    <span className="flex-1 truncate">{t.line}</span>
                    <span className="font-mono text-xs">
                      {t.origDeparture} → {t.origArrival}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={t.delay === "On time" ? "text-emerald-300" : "text-amber-300"}>
                      {t.delay}
                    </span>
                    <span className="text-muted">{t.isDirect ? "direct" : "transfer"}</span>
                  </div>
                  {t.connection && (
                    <div className="text-xs text-muted border-t border-panel-border pt-1.5 mt-1.5">
                      transfer at {t.connection.connectingStation} → {t.connection.trainNumber} (
                      {t.connection.line}) {t.connection.departure} → {t.connection.arrival}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function StationDatalist({ id, stations: list }: { id: string; stations: typeof stations }) {
  return (
    <datalist id={id}>
      {list.map((s) => (
        <option key={s.id} value={s.name} />
      ))}
    </datalist>
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
            className="w-full bg-background border border-panel-border rounded px-2 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-sky-500 mb-2"
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
        className="w-full bg-background border border-panel-border rounded px-2 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-sky-500"
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
      {selection.kind === "station" && <StationDetail stationId={selection.id} />}
    </div>
  );
}

function TrainDetail({ train }: { train: Train | null }) {
  if (!train) {
    return <p className="text-sm text-muted">This train has dropped from the live feed.</p>;
  }
  const lateLabel = train.lateMinutes <= 0 ? "on time" : `${train.lateMinutes} min late`;
  const lateClass =
    train.lateMinutes >= 10
      ? "text-red-400"
      : train.lateMinutes >= 3
        ? "text-amber-300"
        : "text-emerald-300";
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
      <div className={`text-sm font-mono ${lateClass}`}>{lateLabel}</div>
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
  const lateLabel = vehicle.lateMinutes <= 0 ? "on time" : `${vehicle.lateMinutes} min late`;
  const lateClass =
    vehicle.lateMinutes >= 10
      ? "text-red-400"
      : vehicle.lateMinutes >= 3
        ? "text-amber-300"
        : "text-emerald-300";
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
      <div className={`text-sm font-mono ${lateClass}`}>{lateLabel}</div>
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
          const late = /min/i.test(a.status) && !/on time/i.test(a.status);
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
              <div
                className={`text-right text-sm font-mono shrink-0 ${late ? "text-amber-300" : "text-emerald-300"}`}
              >
                {a.status}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
