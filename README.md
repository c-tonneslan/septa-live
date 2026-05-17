# septa-live

Live map of every SEPTA mode that publishes realtime data: Regional Rail, Broad Street Line, Market-Frankford Line, Norristown High Speed Line, every subway-surface trolley (T1-T5), the Girard Avenue trolley, and the suburban trolleys to Media and Sharon Hill. Color-coded with SEPTA Metro's blue/orange/purple/green palette, line shapes drawn between stations, RR trains and surface vehicles polled separately and overlaid on the map.

Built because the official SEPTA app is a list of departures and the agency's website is a static schedule PDF, and neither one lets you actually see the system moving.

## What it does

- **Live RR trains.** TrainView polls every 15 seconds. Each train is a marker at its reported lat/lon, colored by its line, labeled with its train number. 3+ min late gets a red ring; 10+ pulses.
- **Live trolley + NHSL vehicles.** TransitViewAll polls every 15 seconds for everything else SEPTA reports in realtime, filtered to the rail / light-rail / trolley modes. Each vehicle is a smaller marker carrying its Metro letter (T1-T5, G, D1, D2, M). BSL and MFL trains are not published in SEPTA's public realtime feeds, so those lines show shapes + stations only.
- **Color-coded line shapes.** Every line draws a polyline through its stations in order, in SEPTA's published color: BSL orange, MFL blue, NHSL purple, subway-surface trolleys green, Girard yellow, suburban trolleys teal, every RR line in its own color.
- **Stations.** ~140 stations: all 13 RR lines, every BSL stop along Broad Street, every MFL stop along Market Street / Front Street / Kensington Ave / Frankford Ave, every NHSL stop, the trolley tunnel + each surface route's terminus and key intermediate stops.
- **Click a station** and the sidebar fetches the next 10 arrivals from SEPTA's Arrivals endpoint (RR-only; subway/trolley shows a note since SEPTA doesn't publish station-level realtime for those).
- **Click a train or vehicle** to see current stop, next stop, destination, track, delay.
- **Mode-grouped line filter.** Lines collapse into Regional Rail / Subway & Light Rail / Trolley sections. Each section has a one-click hide/show.
- **Most-delayed leaderboard.** Worst late vehicles across every mode, clickable to fly the map there.
- **Alerts banner.** Rotates SEPTA's active service alerts. The "all" toggle expands service alerts + the live elevator-outage list from `/api/elevator`.

## SEPTA APIs used

| Endpoint | What it gives | Refresh |
|---|---|---|
| `TrainView` | RR train positions + delay | 15s |
| `TransitViewAll` | All in-service trolley/NHSL/bus positions | 15s |
| `Arrivals` | Next N RR departures from a station | 20s on click |
| `Alerts` | System service alerts per route | 60s |
| `elevator` | Out-of-service elevators + alternates | 5min |

Every call is fronted by a Next.js API route so Vercel's edge cache absorbs the load and the client never sees an upstream shape change. SEPTA's feeds are inconsistent (Arrivals spells one line three different ways in one response, TransitViewAll uses Metro letters like `T2` while Alerts uses long names like `Market-Frankford`), so `src/data/lines.ts` carries an `apiNames` array per line that canonicalizes every variant onto one Line entry with one color.

## Stack

- Next.js 16 (App Router, Turbopack) on Vercel
- TypeScript, Tailwind CSS v4
- Leaflet (canvas renderer, dark CARTO basemap, polylines + markers)
- SEPTA public APIs: TrainView, TransitViewAll, Arrivals, Alerts, elevator. No key needed.

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
