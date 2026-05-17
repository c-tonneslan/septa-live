# septa-live

A real-time map of every SEPTA train, trolley, and bus in service right now, with multi-modal trip routing across 7,700 stops and a reliability dashboard tracking on-time performance over time. Built because the official SEPTA app is a list of departures and the agency's website is a static schedule PDF, and neither one lets you see the system actually move.

**Live:** [septa-live.vercel.app](https://septa-live.vercel.app) · **Reliability:** [/stats](https://septa-live.vercel.app/stats) · **Embed:** [/embed?lines=PAO,TRE](https://septa-live.vercel.app/embed?lines=PAO,TRE)

![SEPTA Live map screenshot](docs/screenshot.png)

## What it does

- **Live map.** Every Regional Rail train at its real lat/lon (TrainView, 15s). Every in-service trolley, NHSL car, and bus (TransitViewAll, 15s). Color-coded by line, with delay rings (3+ min red, 10+ min pulsing).
- **Real geometry.** Every line's polyline traces SEPTA's actual track or street, not station-to-station diagonals. Stops come from the same trip as the shape so they always sit on the line.
- **Click anything for detail.** Stations show next arrivals (RR). Trains/vehicles show current stop, next stop, destination, delay. Selecting any vehicle dims every other line so its route pops.
- **Trip planner.** Two RR station pickers, returns the next six departures with line color, scheduled times, and transfer info if it's not direct (NextToArrive).
- **Smooth animation.** Vehicles interpolate between polls so they glide along their last-known heading instead of jumping every 15s. One RAF loop processes every active tween, parks itself when idle.
- **Mobile bottom sheet.** On phones the sidebar floats over the map with three states (peek/half/full). Auto-pops to half when you select anything so the detail panel isn't trapped at 64px.
- **Live alerts banner.** SEPTA service alerts rotate; expanding shows them all plus current elevator outages from the accessibility feed.
- **Reliability dashboard at /stats.** A 15-minute GitHub Action snapshots TrainView, summarizes it, and writes to a separate `data` branch. /stats reads that branch and renders on-time percentage per line over the last 7 days, average delay by hour over the last 24h, and a headline summary.
- **Embed mode.** `/embed?lines=PAO,TRE` returns a chrome-less map filtered to specific lines, ready to iframe into a CDC site, a council page, or anywhere.
- **Dynamic OG image.** Sharing the URL produces a card with the current on-time percentage, trains in service, and average delay — fetched from the reliability branch at render time.

## Stack

Next.js 16 (App Router, Turbopack) on Vercel. TypeScript, Tailwind CSS v4, Leaflet on canvas with a dark CARTO basemap. No client state library — `useState` + `useMemo`. Vitest for the data layer. Python for the GTFS generator.

## SEPTA APIs used

| Endpoint | What it gives | Refresh |
|---|---|---|
| `TrainView` | RR train positions + delay in minutes | 15s |
| `TransitViewAll` | Every in-service trolley, NHSL car, and bus | 15s |
| `Arrivals` | Next N RR departures from a station | 20s on click |
| `NextToArrive` | Direct + transfer trips between two stations | 30s on submit |
| `Alerts` | System service alerts per route | 60s |
| `elevator` | Out-of-service elevators + alternate paths | 5min |

Every call is fronted by a Next.js API route so Vercel's edge cache absorbs the load and the client sees a stable shape even when SEPTA's JSON shifts.

## The data is harder than it looks

A few things I ran into that made me write more careful code than I'd planned:

**SEPTA spells the same line three different ways across one response.** Chestnut Hill East shows up as `Chestnut Hill East`, `Chestnut Hl East`, and `Chestnut H East` in a single Arrivals payload. The line registry in `src/data/lines.ts` carries an `apiNames` array per line that canonicalizes every variant onto one Line entry with one color.

**The MFL doesn't run along a flat latitude.** My first pass put every Market Street subway station at lat ~39.952 because that's the latitude at City Hall. Market Street actually drifts ~340m north between 15th and 30th, so the underground stations were rendering 700m south of where they actually are. I rewrote everything to source coordinates and geometry directly from SEPTA's published GTFS (`scripts/gen-gtfs.py`).

**Stops live at the curb, polylines live at the street centerline.** The first time I rendered bus routes, half the stops floated off the line. Turned out the generator was picking the longest shape across all trips for a route but the longest stop list from direction-0 trips — so when those landed on different trips (deadheads, opposite directions, special services), the stops were on a different geometry than the line. Fixed by bundling shape + stops per-trip and picking one representative trip for both.

**SEPTA's GTFS bus route_colors are mostly grey or near-black.** They don't have brand colors like rail lines do, so on the dark map they disappeared. The catalog brightens anything below a luminance threshold and replaces pure grey (R≈G≈B) with amber. Rail line colors are kept untouched because they come from the SEPTA Metro brand palette.

**Bus vehicles outnumbered rail by 10x.** Lifting the vehicle filter to include buses meant 400+ extra markers, plus every bus route's shape would have been ~2.5MB bundled. The fix: bus shapes + stops live in `public/bus-routes.json` and only fetch the first time the user toggles a route on. Bus markers only render for enabled routes. Default state hides buses entirely.

**BSL and MFL trains aren't published in SEPTA's public realtime feeds.** They have GTFS-RT internally but it's not exposed. Those two lines show as shapes + stations only. Realtime works for everything else: RR (TrainView), NHSL + trolleys + buses (TransitView).

**Bus stop predictions aren't published either.** SEPTA used to expose a `bus_stop_predictions` endpoint; it's been deprecated. Stops show static info only.

## Running locally

```
npm install
npm run dev       # http://localhost:3000
npm run test      # Vitest, 22 tests on the data layer
npm run typecheck # tsc --noEmit
```

To regenerate the GTFS-derived data (run when SEPTA pushes a schedule change):

```
python3 scripts/gen-gtfs.py > src/data/generated.ts
```

This downloads https://www3.septa.org/developer/gtfs_public.zip, parses both inner feeds (rail + bus), and writes `src/data/generated.ts` (lines + stations + shapes) plus `public/bus-routes.json` (full bus route shape and stops payload). ~4 seconds end-to-end.

## Reliability tracking

`.github/workflows/snapshot.yml` runs every 15 minutes:

1. Hits TrainView, summarizes (total in service, late counts, average delay, per-line rollup).
2. Appends the snapshot to `data/snapshots.ndjson` on a long-lived orphan branch called `data`.
3. Regenerates `public/stats.json` with rollups: 7-day per-line on-time %, 24-hour hourly average delay, headline.
4. Commits to `data`, which Vercel doesn't watch (so this doesn't blow the deploy quota).

The `/stats` page fetches stats.json from the data branch via `raw.githubusercontent.com` at render time, with a 5-minute revalidate window.

## Why I built this

The official SEPTA app is a list of departures and the agency's website is a static schedule PDF. Neither lets you see the system actually move. This started as a companion to [civic-philly](https://github.com/c-tonneslan/civic-philly) (which tracks SEPTA capital projects as static budget data) and grew into the live-operations half of that story: which trains are running, which are late, what alerts are out, and over time how reliable each line actually is.
