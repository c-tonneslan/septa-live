# septa-live

Live map of SEPTA Regional Rail, Broad Street Line, and Market-Frankford Line. Every train you see is the real train, polled from SEPTA's public APIs every 15 seconds. Color-coded by line, sized by delay, click a station to see the next 10 arrivals, click a train to see where it is and how late.

Built because the official SEPTA app is a list of departures and the agency's website is a static schedule PDF, and neither one lets you actually see the system moving.

## What it does

- **Live trains.** TrainView polls every 15 seconds. Each train is a marker placed by its reported lat/lon, colored by its line, labeled with its train number. Trains 3+ minutes late get a red ring. Trains 10+ minutes late get a pulsing red outline.
- **Stations.** ~100 curated stations across all 13 Regional Rail lines plus every BSL and MFL stop, drawn as small markers with line-colored hover tooltips. Center City hub stations (30th Street, Suburban, Jefferson, Temple) are slightly larger and yellow-rimmed.
- **Click a station** and the sidebar fetches the next 10 arrivals from SEPTA's Arrivals endpoint, split into northbound and southbound, each color-coded by line with departure status (on time vs delayed minutes) and assigned track/platform.
- **Click a train** to see its current stop, next stop, destination, track, origin, and delay in minutes.
- **Line filter.** Toggle any line on or off. Counts update live (total trains running per line, late count in red).
- **Most-delayed leaderboard.** Top five worst-delayed trains across the system, clickable to fly the map to that train.
- **Station search.** Type-ahead picker over the bundled station list.
- **Alerts banner.** Pulls SEPTA's Alerts feed, filters to actual events (alerts, delays, suspensions), rotates one at a time across the top of the page with an "all" toggle to expand the full list.

## Stack

- Next.js 16 (App Router, Turbopack) on Vercel
- TypeScript, Tailwind CSS v4
- Leaflet (canvas renderer, dark CARTO basemap)
- SEPTA public APIs: TrainView, Arrivals, Alerts. No key needed.

The frontend never hits SEPTA directly. Three Next.js API routes proxy each upstream:

- `/api/trains` — TrainView, 15s revalidate
- `/api/arrivals?station=Name` — Arrivals, 20s revalidate
- `/api/alerts` — Alerts, 60s revalidate

This keeps the SEPTA endpoints fronted by Vercel's edge cache (so a viral moment doesn't hammer them) and gives the client a stable shape that doesn't change when the upstream JSON shifts.

## Data notes

Station coordinates and line/route names come from the SEPTA GTFS feed (public domain) cross-referenced against OpenStreetMap. The line registry in `src/data/lines.ts` maps every spelling variant SEPTA's feeds use (the Arrivals API will spell the Chestnut Hill East line three different ways across the same response) to a canonical line entry with a brand color.

Brand colors are from SEPTA's published System Map. The Regional Rail lines kept their letter codes (AIR, CHE, CHW, CYN, FXC, LAN, MED, NOR, PAO, TRE, WAR, WTR, WIL) even after the agency dropped the R1/R2/R3 numbering, so the codes are stable.

## Run locally

```
npm install
npm run dev
```

The dev server hits SEPTA on every API request (cache is disabled in dev). If SEPTA's API is having a bad day you'll see empty arrays rather than errors; the UI handles "no trains" gracefully.

## Why I built it

I wanted to learn the SEPTA API for the [civic-philly](https://github.com/c-tonneslan/civic-philly) project, which surfaces SEPTA capital projects but only as static budget data. Live operations is the other half of that picture: which trains are actually running, which are late, what alerts are out. Now civic-philly can link straight from a SEPTA capital line item to the live status of the line that money's funding.
