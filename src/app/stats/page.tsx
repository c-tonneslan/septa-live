import Link from "next/link";
import { lookupLine } from "@/data/lines";

interface LineRollup {
  line: string;
  avgTrainsPerSample: number;
  onTimePct: number | null;
  avgDelay: number;
  majorDelays: number;
}

interface HourBucket {
  hour: number;
  onTimePct: number | null;
  avgDelay: number;
  samples: number;
}

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
      <div className="max-w-4xl mx-auto space-y-8">
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
            <Headline stats={stats} />
            <LineTable lines={stats.lines} />
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

function Headline({ stats }: { stats: Stats }) {
  const h = stats.headline!;
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Trains in service" value={h.trainsInService.toString()} />
      <Stat
        label="On time"
        value={h.onTimePct !== null ? `${h.onTimePct}%` : "—"}
        tone={h.onTimePct !== null && h.onTimePct >= 85 ? "good" : "warn"}
      />
      <Stat label="Avg delay" value={`${h.avgDelay} min`} />
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

function LineTable({ lines }: { lines: LineRollup[] }) {
  return (
    <section>
      <h2 className="text-sm uppercase tracking-widest text-muted mb-3">
        Last 7 days, by line
      </h2>
      <div className="border border-panel-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel/60 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="text-left px-3 py-2">Line</th>
              <th className="text-right px-3 py-2">On-time</th>
              <th className="text-right px-3 py-2">Avg delay</th>
              <th className="text-right px-3 py-2">10+ late</th>
              <th className="text-right px-3 py-2">Trains</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border">
            {lines.map((l) => {
              const line = lookupLine(l.line);
              return (
                <tr key={l.line}>
                  <td className="px-3 py-2 flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ background: line?.color ?? "#888" }}
                    />
                    <span>{line?.name ?? l.line}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {l.onTimePct !== null ? `${l.onTimePct}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{l.avgDelay} min</td>
                  <td className="px-3 py-2 text-right font-mono text-red-400">
                    {l.majorDelays}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted">
                    {l.avgTrainsPerSample}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HourlyChart({ hourly }: { hourly: HourBucket[] }) {
  const maxDelay = Math.max(0.5, ...hourly.map((h) => h.avgDelay));
  return (
    <section>
      <h2 className="text-sm uppercase tracking-widest text-muted mb-3">
        Last 24h, average delay by hour (Eastern Time)
      </h2>
      <div className="border border-panel-border rounded-md p-4 bg-panel/40">
        <div className="flex items-end gap-1 h-32">
          {hourly.map((h) => {
            const heightPct = (h.avgDelay / maxDelay) * 100;
            const has = h.samples > 0;
            return (
              <div
                key={h.hour}
                className="flex-1 flex flex-col items-center justify-end gap-1"
              >
                <div
                  className={`w-full rounded-sm ${has ? "bg-sky-500/70" : "bg-panel-border/30"}`}
                  style={{ height: `${has ? heightPct : 4}%` }}
                  title={has ? `${h.hour}:00 — ${h.avgDelay.toFixed(1)} min avg` : `${h.hour}:00 — no data`}
                />
                <div className="text-[9px] font-mono text-muted">{h.hour}</div>
              </div>
            );
          })}
        </div>
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
