# Submission copy

Drafts for posting septa-live to different channels. Adapt freely.

## Screenshot to take first

Open the live site, toggle a few interesting things on, hit Cmd+Shift+4 to capture region:

- Center on Philly with the Center City hub visible
- Have multiple lines enabled (RR + MFL + BSL + a trolley)
- At least one bus route enabled so the dashed bus polylines show
- Ideally a couple of trains visibly on the map (best during AM/PM commute UTC hours; check during a known busy window)
- Save as `docs/screenshot.png` in the repo root

A short Loom or QuickTime screen capture (~20-30s) panning around + clicking a train + opening trip planner would be even better. Drop it in docs/ and link from README.

## Hacker News

Title (under 80 chars, no clickbait, no exclamation):

  Show HN: A live map of every SEPTA train, trolley, and bus, with reliability tracking

Body (HN comment, optional but recommended):

  Built this because the official SEPTA app is a list of departures and the agency's website is a static schedule PDF, and neither one lets you see the system actually move. The map polls SEPTA every 15 seconds, animates positions between polls so vehicles glide instead of jumping, and supports multi-modal trip planning across 7,700 stops via a Dijkstra router I bundled into the page.

  The data layer was the most surprising part. SEPTA spells the same line three different ways in one Arrivals response. Their published station coordinates aren't where the hand-curated coordinates I started with put them. Bus stops sit on the curb but route shapes sit on the street centerline, and those have to come from the same trip or stops float off the polyline. Wrote about it: https://c-tonneslan-portfolio.vercel.app/writing/septa-live-data-fights-you

  Repo: https://github.com/c-tonneslan/septa-live

## r/Philadelphia

Title:

  I built a live map of every SEPTA train, trolley, and bus in service right now

Body:

  Hey r/philly. Wanted a thing that showed me what's actually moving on SEPTA in real time instead of staring at the official app's list of departures. Spent a few weekends building it: https://septa-live.vercel.app

  It hits SEPTA's public APIs every 15 seconds for Regional Rail, NHSL, trolleys, and buses. Each line drawn with SEPTA's brand colors (blue L, orange B, purple M, etc.). Click a train to see where it is and how late, click a bus stop for the route, type two places into the trip planner for a multi-modal route across rail + subway + bus.

  Couple honest gaps: SEPTA doesn't publish BSL or MFL train positions in any public endpoint (they have it internally but don't expose it), so those two lines show as shapes only. Same story with bus stop predictions, which the agency deprecated.

  The /stats page tracks on-time performance per line so over time you'll be able to see which lines you can actually count on. Code's open: https://github.com/c-tonneslan/septa-live

## r/SEPTA

Title:

  Built a real-time map of the whole network if anyone finds it useful

Body:

  https://septa-live.vercel.app

  Live train positions for RR, live trolley + bus positions from TransitView, color-coded with the Metro brand palette. Click a station for the next arrivals, click a train for its delay and current stop. Trip planner does multi-modal routing across every stop in the network (about 7,700 of them). Also a /stats page that tracks on-time performance per line over time, snapshotted every 15 minutes from TrainView.

  BSL and MFL train positions aren't there because SEPTA doesn't publish them in their public realtime feeds. Lines + stations are still on the map for those.

  Source: https://github.com/c-tonneslan/septa-live. Open to suggestions.

## LinkedIn

  Built something I wanted: a live map of every SEPTA train, trolley, and bus, with a Dijkstra-based trip router across 7,700 stops and a reliability dashboard tracking on-time performance per line.

  The official agency app is a list of departures. The website is a schedule PDF. Neither shows you the system actually moving. So I made one. https://septa-live.vercel.app

  Built with Next.js, Leaflet, TypeScript, and a Python pipeline that pulls authoritative coordinates and route shapes from SEPTA's published GTFS. Five SEPTA APIs wired in. About 7,700 stops, 173 routes, 31,000 walking transfers in the routing graph.

  Code: https://github.com/c-tonneslan/septa-live
  Writeup on the data layer: https://c-tonneslan-portfolio.vercel.app/writing/septa-live-data-fights-you

## Twitter / X (if used)

  i made a live map of every SEPTA train, trolley, and bus

  trip planner does multi-modal routing across 7,700 stops
  reliability dashboard tracks on-time % per line over time
  septa publishes their data in pretty messy json and i wrote about that

  https://septa-live.vercel.app

## Submission timing

- HN: post Tuesday-Thursday morning ET (best traffic, lower competition vs Mon/Fri). Have screenshots ready in the first comment.
- Reddit: post around 8-9am ET when local subs have peak activity.
- LinkedIn: any weekday morning. Tuesday gets the most reach historically.
- Don't spam-post all four the same day. Stagger one per day.

## What to do with feedback

If a top HN comment points out a real bug or limitation, fix it that night and reply with the commit. That's how you turn a thread into something employers see when they search you.
