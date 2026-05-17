"use client";

import { useEffect, useState } from "react";
import { lines } from "@/data/lines";
import { stations, lookupStation } from "@/data/stations";
import type { Train, StationArrivals } from "@/lib/septa";
import type { Selection } from "./App";

interface Props {
  trains: Train[];
  enabledLines: Set<string>;
  onToggleLine: (id: string) => void;
  onSetAllLines: (on: boolean) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
}

export default function Sidebar({
  trains,
  enabledLines,
  onToggleLine,
  onSetAllLines,
  selection,
  onSelect,
}: Props) {
  return (
    <aside className="bg-panel border-l border-panel-border h-full min-h-0 flex flex-col">
      <header className="px-4 py-3 border-b border-panel-border">
        <h1 className="text-base font-bold tracking-tight">SEPTA Live</h1>
        <p className="text-xs text-muted mt-0.5">
          Real-time Regional Rail, Broad Street, Market-Frankford
        </p>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {selection ? (
          <DetailPanel
            selection={selection}
            trains={trains}
            onClose={() => onSelect(null)}
          />
        ) : (
          <LinePanel
            trains={trains}
            enabledLines={enabledLines}
            onToggleLine={onToggleLine}
            onSetAllLines={onSetAllLines}
            onSelect={onSelect}
          />
        )}
      </div>
    </aside>
  );
}

function LinePanel({
  trains,
  enabledLines,
  onToggleLine,
  onSetAllLines,
  onSelect,
}: {
  trains: Train[];
  enabledLines: Set<string>;
  onToggleLine: (id: string) => void;
  onSetAllLines: (on: boolean) => void;
  onSelect: (s: Selection) => void;
}) {
  const countsByLine = new Map<string, { total: number; late: number; veryLate: number }>();
  for (const t of trains) {
    if (!t.lineId) continue;
    const c = countsByLine.get(t.lineId) ?? { total: 0, late: 0, veryLate: 0 };
    c.total += 1;
    if (t.lateMinutes >= 3) c.late += 1;
    if (t.lateMinutes >= 10) c.veryLate += 1;
    countsByLine.set(t.lineId, c);
  }

  const totalLate = trains.filter((t) => t.lateMinutes >= 3).length;
  const worst = [...trains]
    .filter((t) => t.lateMinutes > 0)
    .sort((a, b) => b.lateMinutes - a.lateMinutes)
    .slice(0, 5);

  return (
    <div className="p-4 space-y-5">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-widest text-muted">System</h2>
          <div className="text-xs text-muted font-mono">
            {trains.length} trains · {totalLate} late
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

      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted mb-2">Lines</h2>
        <ul className="space-y-1">
          {lines.map((l) => {
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
                    {counts ? `${counts.total}` : "—"}
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

      {worst.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-muted mb-2">Most delayed</h2>
          <ul className="space-y-1">
            {worst.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => onSelect({ kind: "train", id: t.id })}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm hover:bg-panel-border/40"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: t.lineColor }}
                  />
                  <span className="font-mono text-xs w-12">{t.id}</span>
                  <span className="flex-1 truncate text-muted">→ {t.destination}</span>
                  <span className="text-red-400 font-mono text-xs">+{t.lateMinutes}m</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted mb-2">Find a station</h2>
        <StationPicker onPick={(id) => onSelect({ kind: "station", id })} />
      </section>
    </div>
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
        placeholder="Suburban, Trenton, Paoli…"
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
  onClose,
}: {
  selection: Selection;
  trains: Train[];
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
      {selection.kind === "train" ? (
        <TrainDetail train={trains.find((t) => t.id === selection.id) ?? null} />
      ) : (
        <StationDetail stationId={selection.id} />
      )}
    </div>
  );
}

function TrainDetail({ train }: { train: Train | null }) {
  if (!train) {
    return (
      <p className="text-sm text-muted">
        This train has dropped from the live feed, probably out of service.
      </p>
    );
  }
  const lateLabel =
    train.lateMinutes <= 0
      ? "on time"
      : `${train.lateMinutes} min late`;
  const lateClass =
    train.lateMinutes >= 10
      ? "text-red-400"
      : train.lateMinutes >= 3
        ? "text-amber-300"
        : "text-emerald-300";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-sm shrink-0"
          style={{ background: train.lineColor }}
        />
        <span className="text-sm font-mono">{train.line}</span>
      </div>
      <div>
        <div className="text-xl font-bold">Train {train.id}</div>
        <div className="text-sm text-muted">{train.service} → {train.destination}</div>
      </div>
      <div className={`text-sm font-mono ${lateClass}`}>{lateLabel}</div>
      <dl className="text-sm grid grid-cols-[7rem_1fr] gap-y-1.5">
        <dt className="text-muted">at</dt>
        <dd>{train.currentStop || "—"}</dd>
        <dt className="text-muted">next stop</dt>
        <dd>{train.nextStop || "—"}</dd>
        <dt className="text-muted">track</dt>
        <dd>{train.track || "—"}</dd>
        <dt className="text-muted">origin</dt>
        <dd>{train.source || "—"}</dd>
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
          <ArrivalsList title="Northbound" arrivals={data.northbound} />
          <ArrivalsList title="Southbound" arrivals={data.southbound} />
          {data.northbound.length === 0 && data.southbound.length === 0 && (
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
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: a.lineColor }}
              />
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
                className={`text-right text-sm font-mono shrink-0 ${
                  late ? "text-amber-300" : "text-emerald-300"
                }`}
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
