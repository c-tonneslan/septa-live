# Sharing kit

Drafts for the first wave of getting septa-live in front of actual Philly commuters. Use these as starting points, not as final copy — every venue has its own tone and the post should sound like a person who lives in Philly wrote it, not a launch announcement.

## When to post

Avoid weekends and avoid early-morning UTC. Best windows for Philly audiences:

- r/philadelphia: weekdays, 7-9am ET or 5-7pm ET (commute slots, ironic for a transit map)
- r/SEPTA: same
- Hacker News Show HN: Tuesday-Thursday, 8-10am ET
- Bluesky / Mastodon: any weekday morning
- Twitter/X: any time, but engagement is lower than Bluesky for civic-tech audiences in Philly right now

Don't dump all of these on the same day. The pattern that works is: one venue per day, watch the comments, respond, then move to the next venue. Five days for the first wave.

## r/philadelphia — first attempt

Title: `I built a live map of every SEPTA train, trolley, and bus`

Body:

> The official SEPTA app shows you a list of departures from one stop. Their website is a static schedule PDF. Neither one lets you actually see the system working.
>
> Made [septa-live.vercel.app](https://septa-live.vercel.app) over the last month or so. Every Regional Rail train, every in-service trolley/NHSL/bus shows up at its real position, color-coded by line, delay rings if it's running late, updates every 15 seconds. Click any vehicle for stop info, click any station for next arrivals. There's a trip planner for the RR too.
>
> A few things that surprised me building it:
> - SEPTA spells "Chestnut Hill East" three different ways in one API response
> - the underground stations on the MFL are about 700 meters off if you assume Market Street is east-west (it tilts northwest)
> - SEPTA doesn't expose realtime positions for the Broad Street or Market-Frankford trains, only the above-ground lines
>
> Free, open source, no ads, no account, no app store. Just open it in a browser. Repo at [github.com/c-tonneslan/septa-live](https://github.com/c-tonneslan/septa-live) if anyone wants to poke at the code.

That last paragraph is doing a lot of work. The "no ads, no account, no app store" line is the one r/philadelphia will actually appreciate — they hate the official app for exactly those reasons. Keep it.

What to do in the comments:

- Reply to anyone who points out a bug with "thanks, can you screenshot it?" and actually fix it
- If anyone asks about adding Patco/NJ Transit/Amtrak, say "GTFS feeds for those are public, it's on the list" — don't promise dates
- Don't argue with people complaining about SEPTA itself; that's not the map's job
- If a mod asks for a flair, use "Question" or "Picture" — there's no "I made a thing" flair last I checked

## r/SEPTA — first attempt

Title: `Live map of every train and bus (with delay info)`

Body: shorter than r/philadelphia. r/SEPTA is smaller and more technical about the system.

> Built [septa-live.vercel.app](https://septa-live.vercel.app). Real-time positions for every Regional Rail train, trolley, NHSL, and bus. Color-coded by line, delay rings (3+ red, 10+ pulsing). Trip planner uses NextToArrive.
>
> BSL and MFL show up as shapes only because SEPTA doesn't publish realtime positions for them on any public endpoint (TrainView is RR-only, TransitViewAll skips subway). Open to ideas if anyone knows how to get those positions.
>
> Stations show next arrivals on click. There's a reliability dashboard at /stats that snapshots TrainView every 15 minutes and tracks on-time percentage per line over 7 days.

The BSL/MFL ask at the end is a hook. r/SEPTA has subway nerds in it and one of them might know about an undocumented endpoint or someone inside SEPTA they can ask. Even if not, framing it as "I don't have this data" reads as honest rather than incomplete.

## Hacker News — Show HN

Title: `Show HN: A live map of every SEPTA vehicle (Philadelphia transit)`

Body:

> I wanted a SEPTA map that showed every train and bus moving in real time. The official app is a list of departures. The agency's website is a static schedule PDF. So I built one. Live at [septa-live.vercel.app](https://septa-live.vercel.app), code at github.com/c-tonneslan/septa-live.
>
> The data is harder than it looks. SEPTA spells the same line three different ways in one API response, Market Street isn't perfectly east-west so hand-coded coordinates drift hundreds of meters, bus stop coordinates and route polyline coordinates come from different trips so they don't always align. I wrote about most of it at [the canonical URL]/writing/septa-live-data-fights-you.
>
> Next.js 16 on Vercel, TypeScript, Leaflet on canvas, Tailwind v4. Python script generates the routes/stops from SEPTA's GTFS zip. The reliability dashboard at /stats snapshots TrainView every 15 minutes via GitHub Action and writes to a `data` branch, so /stats is reading that branch at render time.
>
> Free, no account, no ads, no app store. Happy to talk about any of it.

HN cares about the technical narrative. Lead with the data-quality stories because that's the part HN will engage with — anyone who's worked with GTFS or transit feeds has had similar surprises. Don't lead with "civic tech good." HN bounces off that.

If it gets traction, expect questions about:
- Why Vercel and not self-hosted (answer: free tier handles this fine, edge cache absorbs SEPTA API hits)
- Why Leaflet and not Mapbox/MapLibre (answer: free, canvas renderer scales to thousands of markers, dark CARTO basemap is fine)
- Whether you'll add other transit systems (answer: "I'd take PRs but it's specifically a Philly thing for now")

## Bluesky / Mastodon

One post, ~300 chars, with the screenshot:

> Made a live map of every SEPTA train, trolley, and bus in Philadelphia — real positions, color by line, delay rings. Updates every 15s. Built because the official app is a list of departures and the website is a PDF.
>
> [septa-live.vercel.app](https://septa-live.vercel.app) — free, open source, no account.

Bluesky's civic-tech and Philly communities are smaller but more engaged. Tag #SEPTA and #Philadelphia. If you have a Bluesky handle to tag (PlanPhilly, Billy Penn, Philly transit nerds), do it but don't overdo — one tag per post.

## Local journalists

These three reporters cover Philly transit and have written about civic data tools before. Send a short email per the script below to one at a time, not all three on the same day. Don't pitch it; just share it and let them decide.

- Jake Blumgart (Plan Philly) — covers transit/planning. Email pattern is jake@whyy.org or via WHYY contact form.
- Ryan Briggs (Plan Philly) — civic tech and infrastructure.
- Jordan Levy (Billy Penn / WHYY) — newer reporter, covers transit specifically.

Email script:

> Subject: A live SEPTA map I built
>
> Hi [name] — I'm a Philly resident who got fed up with the SEPTA app and built a real-time map of every train, trolley, and bus. Live at septa-live.vercel.app.
>
> Not pitching this for coverage — just thought you might find it useful, and figured you'd know if there's anything else like it I should have built instead.
>
> A few things that surprised me while building: SEPTA spells the same line three ways in one API response, the underground stations are about 700m off if you use the City Hall latitude for all of Market Street, and SEPTA doesn't publish realtime positions for the BSL or MFL subway trains on any public endpoint.
>
> Free, open source, no account. Code at github.com/c-tonneslan/septa-live.
>
> Cheers,
> Charlie

The "not pitching for coverage" line is doing a lot of work. Reporters get pitched constantly. The one that says "I just thought you'd find this useful" is the one they remember.

## What success looks like

The metric to watch isn't pageviews. It's whether anyone uses it twice. The Vercel analytics will tell you. If 60% of the visitors from r/philadelphia bounce after one session and 40% come back the next morning, you've shipped something with real users. If 95% bounce, the map isn't yet pulling its weight as a daily tool and the work to do next is product (faster initial load, easier to find your specific line, better mobile sheet), not more sharing.

The other metric, lower-frequency but louder: did anyone email you to say they use it? Save those emails. They're the difference between "I built a thing" and "I built a thing people use" in any future hiring conversation.

## What to do if it flops

It probably won't, but if r/philadelphia bounces it (downvotes, mods remove it, no comments), don't take it personally. Reddit is moody. Wait two weeks, post a slightly different version with a different screenshot, frame it as "update" not "launch." Repeat until something sticks.

Hacker News Show HN posts that don't make the front page in the first hour basically don't make it ever. If that happens, repost in 30 days with a different framing — usually "v2 of [thing]" or "[thing], now with [feature]." It's allowed and it works.

Bluesky and Mastodon won't go viral but the people who do engage are exactly the people you want — civic data folks, transit nerds, journalists. One quote-post from PlanPhilly is worth more than 200 Reddit upvotes for the kind of hiring conversations that civic tech jobs come out of.
