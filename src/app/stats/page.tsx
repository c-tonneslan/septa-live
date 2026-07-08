import Link from "next/link";
import { lookupLine } from "@/data/lines";
import {
  rankLines,
  bestWorst,
  freshness,
  isThinSample,
  type LineRollup,
  type HourBucket,
} from "@/lib/statsView";

interface Stats {
  generatedAt: string;
  totalSnapshots: number;
  coverageStart: string | null;
  headline: {
    ts: string;
    trainsInService: number;
    onTimePct: number | null;
    avgDelay: number;
    majorDelays: number;
  } | null;
  lines: LineRollup[];
  hourly: HourBucket[];
}

// Source the snapshot from the `data` branch on GitHub. A 15-minute
// GitHub Action keeps it fresh; that branch never triggers Vercel deploys
// so it's fine to commit to constantly.
const STATS_URL =
  "https://raw.githubusercontent.com/c-tonneslan/septa-live/data/public/stats.json";

export const revalidate = 300;

async function fetchStats(): Promise<Stats | null> {
  try {
    const r = await fetch(STATS_URL, { next: { revalidate: 300 } });
    if (!r.ok) return null;
    return (await r.json()) as Stats;
  } catch {
    return null;
  }
}

export default async function StatsPage() {
  const stats = await fetchStats();

  return (
    <main className="min-h-full bg-background text-foreground px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">SEPTA reliability</h1>
            <p className="text-sm text-muted mt-1">
              Regional Rail on-time performance, derived from SEPTA&apos;s TrainView feed
              polled every 15 minutes.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-muted hover:text-foreground font-mono border-b border-muted/40 hover:border-foreground pb-0.5"
          >
            ← back to live map
          </Link>
        </header>

        {!stats || !stats.headline ? (
          <Empty />
        ) : (
          <>
            <FreshnessStrip generatedAt={stats.generatedAt} />
            <Headline stats={stats} />
            {isThinSample(stats.totalSnapshots) && (
              <SampleCaveat count={stats.totalSnapshots} start={stats.coverageStart} />
            )}
            <BestWorst lines={stats.lines} />
            <LineRanking lines={stats.lines} />
            <HourlyChart hourly={stats.hourly} />
            <Footer stats={stats} />
          </>
        )}
      </div>
    </main>
  );
}

function Empty() {
  return (
    <div className="border border-panel-border rounded-md p-6 text-sm text-muted">
      <p>
        No snapshots yet. The GitHub Action runs every 15 minutes and writes to
        the <code className="text-foreground">data</code> branch. Check back in a few
        hours once enough samples have accumulated.
      </p>
    </div>
  );
}

function FreshnessStrip({ generatedAt }: { generatedAt: string }) {
  const f = freshness(generatedAt);
  if (!f.isStale) {
    return (
      <p className="text-xs font-mono text-muted">
        updated {new Date(generatedAt).toLocaleString()}
      </p>
    );
  }
  return (
    <div className="border border-amber-500/40 bg-amber-500/10 text-amber-200 rounded-md px-3 py-2 text-sm">
      Snapshot is <span className="font-semibold">{f.label}</span> — the collector looks paused
      (last write {new Date(generatedAt).toLocaleString()}). Shown for reference, not live.
    </div>
  );
}

function SampleCaveat({ count, start }: { count: number; start: string | null }) {
  return (
    <p className="text-xs text-muted border-l-2 border-panel-border pl-3">
      Based on {count} snapshots{start ? ` since ${new Date(start).toLocaleDateString()}` : ""} —
      a small sample, so treat the rankings as indicative rather than definitive.
    </p>
  );
}

function Headline({ stats }: { stats: Stats }) {
  const h = stats.headline!;
  // Lead with on-time %. avgDelay is dropped from the headline — a single-snapshot
  // mean is outlier-poisoned (one stuck train swings it to 100+ min).
  return (
    <section className="grid grid-cols-3 gap-3">
      <Stat
        label="On time"
        value={h.onTimePct !== null ? `${h.onTimePct}%` : "—"}
        tone={h.onTimePct !== null && h.onTimePct >= 85 ? "good" : "warn"}
      />
      <Stat label="Trains in service" value={h.trainsInService.toString()} />
      <Stat
        label="10+ min late"
        value={h.majorDelays.toString()}
        tone={h.majorDelays > 5 ? "warn" : "neutral"}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const color =
    tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-foreground";
  return (
    <div className="border border-panel-border rounded-md p-3 bg-panel/40">
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function BestWorst({ lines }: { lines: LineRollup[] }) {
  const { best, worst } = bestWorst(lines);
  if (!best || !worst) return null;
  const card = (l: LineRollup, label: string, tone: "good" | "warn") => {
    const line = lookupLine(l.line);
    return (
      <div className="flex-1 border border-panel-border rounded-md p-3 bg-panel/40">
        <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: line?.color ?? "#888" }} />
          <span className="font-semibold truncate">{line?.name ?? l.line}</span>
          <span className={`font-mono ml-auto ${tone === "good" ? "text-emerald-300" : "text-amber-300"}`}>
            {l.onTimePct}%
          </span>
        </div>
      </div>
    );
  };
  return (
    <section className="space-y-1">
      <div className="flex gap-3">
        {card(best, "Most reliable", "good")}
        {card(worst, "Least reliable", "warn")}
      </div>
      <p className="text-[11px] text-muted">indicative — small sample</p>
    </section>
  );
}

function LineRanking({ lines }: { lines: LineRollup[] }) {
  const ranked = rankLines(lines);
  return (
    <section>
      <h2 className="text-sm uppercase tracking-widest text-muted mb-3">Last 7 days, by line</h2>
      <div className="border border-panel-border rounded-md divide-y divide-panel-border">
        {ranked.map((l) => {
          const line = lookupLine(l.line);
          const rated = l.onTimePct !== null;
          return (
            <div key={l.line} className={`px-3 py-2.5 flex items-center gap-3 ${rated ? "" : "opacity-50"}`}>
              <span className="font-mono text-xs text-muted w-5 shrink-0 text-right">{l.rank}</span>
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: line?.color ?? "#888" }} />
              <span className="w-40 shrink-0 truncate text-sm">{line?.name ?? l.line}</span>
              {/* on-time bar on a fixed 0–100 scale (not scaled to the data max) */}
              <div className="flex-1 h-2 rounded-full bg-panel-border/40 overflow-hidden">
                {rated && (
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${l.onTimePct}%`, background: line?.color ?? "#888" }}
                  />
                )}
              </div>
              <span className="font-mono text-sm w-12 text-right shrink-0">
                {rated ? `${l.onTimePct}%` : "—"}
              </span>
              <span className="font-mono text-[11px] text-muted w-24 text-right shrink-0 hidden sm:inline">
                {l.avgTrainsPerSample} trains/poll
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted mt-1">
        Ranked by on-time %. &quot;10+ min late&quot; counts are available in the raw data.
      </p>
    </section>
  );
}

function HourlyChart({ hourly }: { hourly: HourBucket[] }) {
  return (
    <section>
      <h2 className="text-sm uppercase tracking-widest text-muted mb-3">
        On-time % by hour (Eastern Time)
      </h2>
      <div className="border border-panel-border rounded-md p-4 bg-panel/40">
        <div className="flex items-end gap-1 h-32">
          {hourly.map((h) => {
            const has = h.samples > 0 && h.onTimePct !== null;
            const pct = has ? (h.onTimePct as number) : 0;
            return (
              <div key={h.hour} className="flex-1 flex flex-col items-center justify-end gap-1">
                {has ? (
                  <div
                    className="w-full rounded-sm bg-sky-500/70"
                    style={{ height: `${pct}%` }}
                    title={`${h.hour}:00 — ${pct}% on time · ${h.samples} sample${h.samples === 1 ? "" : "s"}`}
                  />
                ) : (
                  // distinct "no data" stub — never a 0-height bar that reads as 0% on time
                  <div
                    className="w-full h-1.5 rounded-sm bg-panel-border/40 border border-dashed border-panel-border"
                    title={`${h.hour}:00 — no data`}
                  />
                )}
                <div className="text-[9px] font-mono text-muted">{h.hour}</div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted mt-2">
          Bars show on-time % (taller = better). Dashed stubs are hours with no snapshot; most hours
          have a single sample.
        </p>
      </div>
    </section>
  );
}

function Footer({ stats }: { stats: Stats }) {
  return (
    <footer className="text-xs font-mono text-muted border-t border-panel-border pt-4">
      {stats.totalSnapshots} snapshots collected since{" "}
      {stats.coverageStart ? new Date(stats.coverageStart).toLocaleString() : "—"}
      {" · "}
      latest snapshot {new Date(stats.generatedAt).toLocaleString()}
      {" · "}
      <a
        href="https://github.com/c-tonneslan/septa-live/tree/data"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-current/40 hover:decoration-current"
      >
        raw data
      </a>
    </footer>
  );
}
