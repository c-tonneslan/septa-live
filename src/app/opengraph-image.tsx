import { ImageResponse } from "next/og";

// Dynamic OG image. Fetches the latest reliability snapshot from the data
// branch so a Slack/Twitter share shows current SEPTA on-time numbers
// instead of a static screenshot.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SEPTA Live — real-time map of Regional Rail, subway, trolley, and bus";

const STATS_URL =
  "https://raw.githubusercontent.com/c-tonneslan/septa-live/data/public/stats.json";

interface Stats {
  headline?: {
    trainsInService: number;
    onTimePct: number | null;
    avgDelay: number;
    majorDelays: number;
  } | null;
}

async function fetchStats(): Promise<Stats | null> {
  try {
    const r = await fetch(STATS_URL, { next: { revalidate: 300 } });
    if (!r.ok) return null;
    return (await r.json()) as Stats;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const stats = await fetchStats();
  const h = stats?.headline ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0b0f14",
          color: "#e6edf3",
          display: "flex",
          flexDirection: "column",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: "#34d399",
            }}
          />
          <div style={{ fontSize: 28, color: "#8b96a8", fontFamily: "monospace" }}>
            septa-live.vercel.app
          </div>
        </div>

        <div style={{ fontSize: 92, fontWeight: 800, marginTop: 30, lineHeight: 1 }}>
          SEPTA Live
        </div>
        <div style={{ fontSize: 36, color: "#8b96a8", marginTop: 16, maxWidth: 900 }}>
          Real-time map of every Regional Rail train, subway, trolley, and bus.
        </div>

        {h && (
          <div
            style={{
              display: "flex",
              gap: 30,
              marginTop: "auto",
              borderTop: "1px solid #1f2733",
              paddingTop: 30,
            }}
          >
            <Stat label="Trains in service" value={h.trainsInService.toString()} />
            <Stat
              label="On time"
              value={h.onTimePct !== null ? `${h.onTimePct}%` : "—"}
              tone={h.onTimePct !== null && h.onTimePct >= 85 ? "#34d399" : "#fbbf24"}
            />
            <Stat label="Avg delay" value={`${h.avgDelay} min`} />
            <Stat
              label="10+ min late"
              value={h.majorDelays.toString()}
              tone={h.majorDelays > 5 ? "#f87171" : undefined}
            />
          </div>
        )}

        {!h && (
          <div
            style={{
              marginTop: "auto",
              fontSize: 24,
              color: "#8b96a8",
              fontFamily: "monospace",
              borderTop: "1px solid #1f2733",
              paddingTop: 30,
            }}
          >
            13 RR lines · BSL · MFL · NHSL · 5 trolleys · 150 bus routes · 5 SEPTA APIs
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 18,
          color: "#8b96a8",
          textTransform: "uppercase",
          letterSpacing: 2,
          fontFamily: "monospace",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 48, fontWeight: 700, color: tone ?? "#e6edf3" }}>{value}</div>
    </div>
  );
}
