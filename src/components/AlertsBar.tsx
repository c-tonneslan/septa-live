"use client";

import { useEffect, useState } from "react";
import type { Alert, ElevatorOutage } from "@/lib/septa";

const severityColor: Record<Alert["severity"], string> = {
  suspension: "bg-red-600/15 text-red-300 border-red-600/40",
  alert: "bg-red-500/10 text-red-200 border-red-500/40",
  delay: "bg-amber-500/10 text-amber-200 border-amber-500/40",
  detour: "bg-amber-500/10 text-amber-200 border-amber-500/40",
  advisory: "bg-sky-500/10 text-sky-200 border-sky-500/40",
};

export default function AlertsBar({
  alerts,
  elevators,
}: {
  alerts: Alert[];
  elevators: ElevatorOutage[];
}) {
  const interesting = alerts.filter(
    (a) => a.severity === "alert" || a.severity === "delay" || a.severity === "suspension",
  );
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (interesting.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % interesting.length), 8000);
    return () => clearInterval(t);
  }, [interesting.length]);

  // Alerts get refetched every 60s. If the list shrunk past our cursor,
  // interesting[idx] is undefined and we crash on .severity below. Pull
  // back into range whenever the count changes.
  useEffect(() => {
    if (idx >= interesting.length) setIdx(0);
  }, [idx, interesting.length]);

  if (interesting.length === 0 && elevators.length === 0) {
    return (
      <div className="bg-panel/60 border-b border-panel-border px-4 py-2 text-xs font-mono text-muted flex items-center gap-3">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
        SEPTA: no active system alerts
      </div>
    );
  }

  // No active line alerts but elevators are out: surface that as the headline.
  if (interesting.length === 0) {
    return (
      <ElevatorOnly elevators={elevators} open={open} setOpen={setOpen} />
    );
  }

  // Clamp on read so we don't crash the render between an alerts refetch
  // (which can shrink interesting) and the effect above firing. Use the same
  // clamped index for the position label so it can't read e.g. "4/3".
  const safeIdx = idx < interesting.length ? idx : 0;
  const current = interesting[safeIdx];
  const cls = severityColor[current.severity];

  return (
    <div className={`border-b border-panel-border ${cls.split(" ").slice(0,2).join(" ")}`}>
      <div className="px-4 py-2 flex items-center gap-3 text-sm">
        <span className={`uppercase font-mono text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>
          {current.severity}
        </span>
        <span className="font-mono text-xs opacity-80">{current.routeName}</span>
        <span className="truncate flex-1">
          {current.message || current.advisory || current.detour}
        </span>
        <span className="text-xs font-mono opacity-60 whitespace-nowrap">
          {safeIdx + 1}/{interesting.length}
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-mono px-2 py-0.5 rounded border border-current/40 hover:bg-current/10"
        >
          {open ? "hide" : `all (${interesting.length + elevators.length})`}
        </button>
      </div>
      {open && (
        <div className="max-h-64 overflow-y-auto px-4 py-2 border-t border-current/20 text-xs space-y-3 scrollbar-thin">
          {interesting.length > 0 && (
            <div className="space-y-2">
              <div className="font-mono opacity-60 uppercase tracking-widest text-[10px]">
                Service alerts
              </div>
              {interesting.map((a, i) => (
                <div key={i} className="flex gap-3">
                  <span className="font-mono opacity-60 w-20 shrink-0">{a.routeId}</span>
                  <span className="flex-1">{a.message || a.advisory || a.detour}</span>
                </div>
              ))}
            </div>
          )}
          {elevators.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-current/20">
              <div className="font-mono opacity-60 uppercase tracking-widest text-[10px]">
                Elevator outages ({elevators.length})
              </div>
              {elevators.map((e, i) => (
                <div key={i} className="flex gap-3">
                  <span className="font-mono opacity-60 w-32 shrink-0 truncate">{e.station}</span>
                  <span className="flex-1">
                    {e.elevator} · {e.message}
                    {e.alternateUrl && (
                      <a
                        href={e.alternateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 underline decoration-current/40"
                      >
                        alternates
                      </a>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ElevatorOnly({
  elevators,
  open,
  setOpen,
}: {
  elevators: ElevatorOutage[];
  open: boolean;
  setOpen: (fn: (o: boolean) => boolean) => void;
}) {
  return (
    <div className="bg-sky-500/10 text-sky-200 border-sky-500/40 border-b">
      <div className="px-4 py-2 flex items-center gap-3 text-sm">
        <span className="uppercase font-mono text-[10px] px-1.5 py-0.5 rounded border border-current/40">
          access
        </span>
        <span className="truncate flex-1">
          {elevators.length} elevator{elevators.length === 1 ? "" : "s"} out of service
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-mono px-2 py-0.5 rounded border border-current/40 hover:bg-current/10"
        >
          {open ? "hide" : "details"}
        </button>
      </div>
      {open && (
        <div className="max-h-64 overflow-y-auto px-4 py-2 border-t border-current/20 text-xs space-y-2 scrollbar-thin">
          {elevators.map((e, i) => (
            <div key={i} className="flex gap-3">
              <span className="font-mono opacity-60 w-32 shrink-0 truncate">{e.station}</span>
              <span className="flex-1">
                {e.elevator} · {e.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
