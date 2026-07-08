#!/usr/bin/env node
// Hit SEPTA's TrainView once, summarize, append to data/snapshots.ndjson,
// regenerate public/stats.json. Designed to run from a GitHub Action every
// 15 minutes on a `data` branch (so commits don't trigger Vercel deploys).

import fs from "node:fs";
import path from "node:path";

const TRAIN_VIEW = "https://www3.septa.org/api/TrainView/index.php";
const SNAPSHOTS_PATH = "data/snapshots.ndjson";
const STATS_PATH = "public/stats.json";

const lineNameToId = {
  Airport: "AIR",
  "Chestnut Hill East": "CHE", "Chestnut Hl East": "CHE", "Chestnut H East": "CHE",
  "Chestnut Hill West": "CHW", "Chestnut Hl West": "CHW", "Chestnut H West": "CHW",
  Cynwyd: "CYN",
  "Fox Chase": "FOX",
  "Lansdale/Doylestown": "LAN", Lansdale: "LAN", Doylestown: "LAN",
  "Media/Wawa": "MED", "Media/Elwyn": "MED", Wawa: "MED", Elwyn: "MED",
  "Manayunk/Norristown": "NOR", Norristown: "NOR",
  "Paoli/Thorndale": "PAO", Paoli: "PAO", Thorndale: "PAO",
  Trenton: "TRE",
  Warminster: "WAR",
  "West Trenton": "WTR", "W Trenton": "WTR",
  "Wilmington/Newark": "WIL", Wilmington: "WIL", Newark: "WIL",
};

async function fetchTrains() {
  const r = await fetch(TRAIN_VIEW, { headers: { "user-agent": "septa-live snapshot/1.0" } });
  if (!r.ok) throw new Error(`TrainView: ${r.status}`);
  const text = await r.text();
  return JSON.parse(text || "[]");
}

function summarize(trains) {
  const byLine = {};
  let total = 0;
  let lateAny = 0;
  let lateMajor = 0;
  let delaySum = 0;
  for (const t of trains) {
    const lid = lineNameToId[t.line] ?? "UNK";
    // SEPTA uses 998/999 as "no estimate available" sentinels — clamp to 0 so a
    // single annulled/ghost train can't swing a line's avg delay to ~999 min.
    const raw = Number(t.late);
    const late = Number.isFinite(raw) && Math.abs(raw) < 900 ? raw : 0;
    const b = (byLine[lid] ??= { total: 0, late3: 0, late10: 0, delaySum: 0 });
    b.total += 1;
    if (late >= 3) b.late3 += 1;
    if (late >= 10) b.late10 += 1;
    b.delaySum += Math.max(0, late);
    total += 1;
    if (late >= 3) lateAny += 1;
    if (late >= 10) lateMajor += 1;
    delaySum += Math.max(0, late);
  }
  return {
    ts: new Date().toISOString(),
    total,
    onTime: total - lateAny,
    late3: lateAny,
    late10: lateMajor,
    avgDelay: total > 0 ? +(delaySum / total).toFixed(2) : 0,
    byLine,
  };
}

function appendSnapshot(snap) {
  fs.mkdirSync(path.dirname(SNAPSHOTS_PATH), { recursive: true });
  fs.appendFileSync(SNAPSHOTS_PATH, JSON.stringify(snap) + "\n");
}

function readSnapshots() {
  if (!fs.existsSync(SNAPSHOTS_PATH)) return [];
  return fs
    .readFileSync(SNAPSHOTS_PATH, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildStats(snaps) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const last24 = snaps.filter((s) => now - new Date(s.ts).getTime() < day);
  const last7 = snaps.filter((s) => now - new Date(s.ts).getTime() < 7 * day);

  // Rollup per line over the last 7 days
  const byLine = {};
  for (const s of last7) {
    for (const [lid, b] of Object.entries(s.byLine)) {
      const a = (byLine[lid] ??= { total: 0, late3: 0, late10: 0, delaySum: 0, samples: 0 });
      a.total += b.total;
      a.late3 += b.late3;
      a.late10 += b.late10;
      a.delaySum += b.delaySum;
      a.samples += 1;
    }
  }
  const linesRollup = Object.entries(byLine).map(([lid, a]) => ({
    line: lid,
    avgTrainsPerSample: +(a.total / Math.max(1, a.samples)).toFixed(1),
    onTimePct: a.total > 0 ? +((1 - a.late3 / a.total) * 100).toFixed(1) : null,
    avgDelay: a.total > 0 ? +(a.delaySum / a.total).toFixed(2) : 0,
    majorDelays: a.late10,
  })).sort((a, b) => (b.onTimePct ?? 0) - (a.onTimePct ?? 0));

  // Hourly bucket over last 24h, in America/New_York. SEPTA's a Philly
  // agency, so showing UTC on the chart was always wrong (and shifted by
  // an hour twice a year on top of that). We accumulate sums and divide
  // once, since the previous (a + b) / 2 form wasn't a real running
  // average -- the last sample ended up weighted at ~50%.
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
  function etHour(iso) {
    const h = parseInt(hourFormatter.format(new Date(iso)), 10);
    // "24" can come back for midnight depending on the runtime; normalize.
    return h === 24 ? 0 : h;
  }
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h, onTimePct: null, avgDelay: 0, samples: 0,
    _pctSum: 0, _pctSamples: 0, _delaySum: 0,
  }));
  for (const s of last24) {
    const bucket = hourly[etHour(s.ts)];
    bucket.samples += 1;
    bucket._delaySum += s.avgDelay;
    if (s.total > 0) {
      bucket._pctSum += ((s.total - s.late3) / s.total) * 100;
      bucket._pctSamples += 1;
    }
  }
  for (const b of hourly) {
    b.onTimePct = b._pctSamples > 0 ? +(b._pctSum / b._pctSamples).toFixed(1) : null;
    b.avgDelay = b.samples > 0 ? +(b._delaySum / b.samples).toFixed(2) : 0;
    delete b._pctSum;
    delete b._pctSamples;
    delete b._delaySum;
  }

  // Headline
  const recent = last24[last24.length - 1] ?? snaps[snaps.length - 1];
  const headline = recent
    ? {
        ts: recent.ts,
        trainsInService: recent.total,
        onTimePct: recent.total > 0 ? +((1 - recent.late3 / recent.total) * 100).toFixed(1) : null,
        avgDelay: recent.avgDelay,
        majorDelays: recent.late10,
      }
    : null;

  return {
    generatedAt: new Date().toISOString(),
    totalSnapshots: snaps.length,
    coverageStart: snaps[0]?.ts ?? null,
    headline,
    lines: linesRollup,
    hourly,
  };
}

(async function main() {
  const trains = await fetchTrains();
  const snap = summarize(trains);
  appendSnapshot(snap);
  const stats = buildStats(readSnapshots());
  fs.mkdirSync(path.dirname(STATS_PATH), { recursive: true });
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
  console.log(`snapshot: ${snap.total} trains, ${snap.late3} late · ${snap.late10} major`);
  console.log(`stats: ${stats.totalSnapshots} snapshots over ${stats.coverageStart} → ${stats.generatedAt}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
