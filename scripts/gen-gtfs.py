#!/usr/bin/env python3
"""Regenerate src/data/generated.ts from SEPTA's published GTFS feed.

SEPTA publishes the full GTFS bundle at
https://www3.septa.org/developer/gtfs_public.zip. It contains two zips
inside (one for Regional Rail, one for everything else SEPTA calls 'bus'
including the subway lines, trolleys, and NHSL). This script pulls every
non-bus route's stops + shape geometry and emits a single TypeScript
module the app imports.

Usage:
    python scripts/gen-gtfs.py > src/data/generated.ts

Why coordinates were wrong before: the previous station list was curated by
hand under the assumption Market Street had a flat latitude through Center
City. It doesn't — Market drifts ~340m north between 15th and 30th — so the
MFL underground stations were rendering 700-900m south of where they
actually are. GTFS is the source of truth.
"""

import csv
import io
import json
import os
import re
import sys
import urllib.request
import zipfile
from collections import defaultdict

GTFS_URL = "https://www3.septa.org/developer/gtfs_public.zip"

# Brand colors: GTFS route_color where the agency publishes one, SEPTA
# Metro brand-guide hex for the trolley/subway family colors.
RR_LINES = [
    # (id, name, short, mode, color, apiNames)
    ("AIR","Airport","AIR","rr","#4F758B",["Airport"]),
    ("CHE","Chestnut Hill East","CHE","rr","#7D6C46",["Chestnut Hill East","Chestnut Hl East","Chestnut H East"]),
    ("CHW","Chestnut Hill West","CHW","rr","#B96F4A",["Chestnut Hill West","Chestnut Hl West","Chestnut H West"]),
    ("CYN","Cynwyd","CYN","rr","#7A7A7A",["Cynwyd"]),
    ("FOX","Fox Chase","FXC","rr","#DD3A86",["Fox Chase"]),
    ("LAN","Lansdale/Doylestown","LAN","rr","#E6B300",["Lansdale/Doylestown","Lansdale","Doylestown"]),
    ("MED","Media/Wawa","MED","rr","#8F1B2D",["Media/Wawa","Media/Elwyn","Wawa","Elwyn"]),
    ("NOR","Manayunk/Norristown","NOR","rr","#9B6D3C",["Manayunk/Norristown","Norristown"]),
    ("PAO","Paoli/Thorndale","PAO","rr","#9933A5",["Paoli/Thorndale","Paoli","Thorndale"]),
    ("TRE","Trenton","TRE","rr","#1B3E8F",["Trenton"]),
    ("WAR","Warminster","WAR","rr","#DF3D2D",["Warminster"]),
    ("WTR","West Trenton","WTR","rr","#0A8A3E",["West Trenton","W Trenton"]),
    ("WIL","Wilmington/Newark","WIL","rr","#005EA8",["Wilmington/Newark","Wilmington","Newark"]),
]

METRO_LINES = [
    # (gtfs_id, internal_id, metro_letter, name, short, mode, color, apiNames)
    ("L1","MFL","L","Market-Frankford Line","L","mfl","#0097D6",
        ["Market-Frankford","MFL","L","L1","Market Frankford","Market Street Elevated"]),
    ("B1","BSL","B","Broad Street Line","B","bsl","#F26100",
        ["Broad Street","BSL","B","B1","B2","Broad St","Broad Ridge Spur"]),
    ("M1","NHSL","M","Norristown High Speed Line","M","nhsl","#5F249F",
        ["Norristown High Speed","NHSL","M","M1","Route 100"]),
    ("T1","T1","T1","Route 10 — Lancaster Ave","T1","trolley","#00A551",["T1","10","Route 10"]),
    ("T2","T2","T2","Route 11 — Woodland Ave","T2","trolley","#00A551",["T2","11","Route 11"]),
    ("T3","T3","T3","Route 13 — Chester Ave","T3","trolley","#00A551",["T3","13","Route 13"]),
    ("T4","T4","T4","Route 34 — Baltimore Ave","T4","trolley","#00A551",["T4","34","Route 34"]),
    ("T5","T5","T5","Route 36 — Elmwood Ave","T5","trolley","#00A551",["T5","36","Route 36"]),
    ("D1","D1","D1","Route 101 — Media","D1","suburban-trolley","#DC2E6B",["D1","101","Route 101"]),
    ("D2","D2","D2","Route 102 — Sharon Hill","D2","suburban-trolley","#DC2E6B",["D2","102","Route 102"]),
]

TROLLEY_MODES = {"trolley", "suburban-trolley"}


def fetch_gtfs():
    """Download the SEPTA GTFS bundle and extract both inner zips into a dict."""
    print("fetching gtfs...", file=sys.stderr)
    raw = urllib.request.urlopen(GTFS_URL, timeout=60).read()
    outer = zipfile.ZipFile(io.BytesIO(raw))
    feeds = {}
    for name, key in [("google_rail.zip", "rail"), ("google_bus.zip", "bus")]:
        inner = zipfile.ZipFile(io.BytesIO(outer.read(name)))
        files = {n: inner.read(n).decode("utf-8") for n in inner.namelist()}
        feeds[key] = files
    return feeds


def read(text):
    return list(csv.DictReader(io.StringIO(text)))


def load_stops(text):
    out = {}
    for row in read(text):
        try:
            out[row["stop_id"]] = {
                "name": row["stop_name"],
                "lat": float(row["stop_lat"]),
                "lon": float(row["stop_lon"]),
            }
        except (ValueError, KeyError):
            pass
    return out


def load_shapes(text):
    shapes = defaultdict(list)
    for row in read(text):
        try:
            shapes[row["shape_id"]].append(
                (int(row["shape_pt_sequence"]),
                 float(row["shape_pt_lat"]),
                 float(row["shape_pt_lon"]))
            )
        except (ValueError, KeyError):
            pass
    for sid in shapes:
        shapes[sid].sort()
        shapes[sid] = [(la, lo) for _, la, lo in shapes[sid]]
    return shapes


def build_trip_index(trips_text, stop_times_text, shapes):
    """Parse trips + stop_times once and return a per-route, per-direction
    list of {trip_id, shape, stops} entries. The point: when we later pick a
    representative trip for a route, the chosen trip's shape and stop list
    come from the SAME trip - so the rendered polyline goes past every
    rendered stop. Picking shape and stops independently could land them on
    different trips (different directions, deadheads, special services) and
    the stops would float off the line."""
    trip_meta = {}  # trip_id -> (route_id, direction_id, shape_id)
    for row in read(trips_text):
        trip_meta[row["trip_id"]] = (row["route_id"], row.get("direction_id", "0"), row.get("shape_id", ""))

    by_trip_stops = defaultdict(list)
    for row in read(stop_times_text):
        try:
            by_trip_stops[row["trip_id"]].append((int(row["stop_sequence"]), row["stop_id"]))
        except (ValueError, KeyError):
            pass

    index = defaultdict(list)  # (route_id, direction) -> list of trip dicts
    for trip_id, (rid, dir_id, shape_id) in trip_meta.items():
        stop_seq = by_trip_stops.get(trip_id, [])
        if not stop_seq: continue
        index[(rid, dir_id)].append({
            "trip_id": trip_id,
            "shape": shapes.get(shape_id, []),
            "stops": [sid for _, sid in sorted(stop_seq)],
        })
    return index


def representative_trip(trip_index, route_id, direction="0"):
    """Return the longest-stop-list trip for (route_id, direction), falling
    back to the other direction. Shape and stop list come from the same trip
    so they're guaranteed coherent."""
    trips = trip_index.get((route_id, direction)) or trip_index.get((route_id, "0" if direction == "1" else "1"))
    if not trips: return None
    return max(trips, key=lambda t: len(t["stops"]))


def stops_for_route(trip_index, route_id, direction="0"):
    t = representative_trip(trip_index, route_id, direction)
    return t["stops"] if t else []


def shape_for_route(trip_index, route_id, direction="0"):
    t = representative_trip(trip_index, route_id, direction)
    return t["shape"] if t else []


def is_trolley_street_stop(name):
    """Trolley street-running stops look like 'Baltimore Av & 51st St'; drop
    those from the marker layer so the map isn't littered with every-block
    stops. The route polylines still trace the real street geometry."""
    if " & " in name or "&" in name: return True
    if name.endswith(" - FS") or name.endswith(" - MBFS"): return True
    return False


def brighten_color(hex_color):
    """Match the runtime brightening in src/data/buses.ts so the network
    graph uses the same colors the live map renders."""
    h = hex_color.replace("#", "")
    if len(h) != 6: return hex_color
    try:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except ValueError:
        return hex_color
    lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    if lum >= 0.55: return hex_color
    spread = max(r, g, b) - min(r, g, b)
    if spread < 10: return "#F59E0B"
    peak = max(r, g, b, 1)
    factor = 230 / peak
    nr, ng, nb = min(255, round(r * factor)), min(255, round(g * factor)), min(255, round(b * factor))
    return "#%02X%02X%02X" % (nr, ng, nb)


def ts_string(s):
    return json.dumps(s)


def ts_coord_array(coords):
    return "[" + ",".join(f"[{a:.5f},{b:.5f}]" for a, b in coords) + "]"


def load_routes(text):
    out = {}
    for row in read(text):
        out[row["route_id"]] = {
            "id": row["route_id"],
            "short": row.get("route_short_name", "") or row["route_id"],
            "name": row.get("route_long_name", ""),
            "color": "#" + (row.get("route_color") or "888888").upper(),
            "type": row.get("route_type", ""),
        }
    return out


def main():
    feeds = fetch_gtfs()

    print("parsing rail...", file=sys.stderr)
    rr_stops = load_stops(feeds["rail"]["stops.txt"])
    rr_shapes = load_shapes(feeds["rail"]["shapes.txt"])
    rr_trip_index = build_trip_index(feeds["rail"]["trips.txt"], feeds["rail"]["stop_times.txt"], rr_shapes)

    print("parsing bus...", file=sys.stderr)
    bus_stops = load_stops(feeds["bus"]["stops.txt"])
    bus_shapes = load_shapes(feeds["bus"]["shapes.txt"])
    bus_trip_index = build_trip_index(feeds["bus"]["trips.txt"], feeds["bus"]["stop_times.txt"], bus_shapes)
    bus_routes = load_routes(feeds["bus"]["routes.txt"])

    stations = {}
    station_order_by_line = {}

    def add(cid, name, lat, lon, line_id):
        s = stations.setdefault(cid, {
            "id": cid, "name": name, "lat": lat, "lon": lon,
            "lineIds": set(), "apiNames": set(),
        })
        s["lineIds"].add(line_id)
        s["apiNames"].add(name)

    for (lid, _name, _short, _mode, _color, _api) in RR_LINES:
        order = stops_for_route(rr_trip_index, lid, "0")
        if not order:
            order = stops_for_route(rr_trip_index, lid, "1")
        out = []
        for sid in order:
            if sid not in rr_stops: continue
            cid = f"rr-{sid}"
            s = rr_stops[sid]
            add(cid, s["name"], s["lat"], s["lon"], lid)
            out.append(cid)
        station_order_by_line[lid] = out

    for (gid, lid, _metro, _name, _short, mode, _color, _api) in METRO_LINES:
        order = stops_for_route(bus_trip_index, gid, "0")
        if not order:
            order = stops_for_route(bus_trip_index, gid, "1")
        out = []
        for sid in order:
            if sid not in bus_stops: continue
            s = bus_stops[sid]
            if mode in TROLLEY_MODES and is_trolley_street_stop(s["name"]):
                continue
            cid = f"m-{sid}"
            add(cid, s["name"], s["lat"], s["lon"], lid)
            out.append(cid)
        station_order_by_line[lid] = out

    print("// AUTO-GENERATED from SEPTA GTFS. Do not edit by hand.")
    print("// Run scripts/gen-gtfs.py to regenerate.")
    print()
    print("export const GENERATED_STATIONS = [")
    for cid, s in stations.items():
        print(f'  {{ id: {ts_string(cid)}, name: {ts_string(s["name"])}, '
              f'lat: {s["lat"]:.5f}, lon: {s["lon"]:.5f}, '
              f'lineIds: {json.dumps(sorted(s["lineIds"]))}, '
              f'apiNames: {json.dumps(sorted(s["apiNames"]))} }},')
    print("];")
    print()
    print("export const GENERATED_LINES = [")
    for (lid, name, short, mode, color, api) in RR_LINES:
        order = station_order_by_line.get(lid, [])
        shape = shape_for_route(rr_trip_index, lid, "0") or shape_for_route(rr_trip_index, lid, "1")
        print(f'  {{ id: {ts_string(lid)}, name: {ts_string(name)}, short: {ts_string(short)}, '
              f'mode: {ts_string(mode)}, color: {ts_string(color)}, '
              f'apiNames: {json.dumps(api)}, stationOrder: {json.dumps(order)}, '
              f'shape: {ts_coord_array(shape)} }},')
    for (gid, lid, metro, name, short, mode, color, api) in METRO_LINES:
        order = station_order_by_line.get(lid, [])
        shape = shape_for_route(bus_trip_index, gid, "0") or shape_for_route(bus_trip_index, gid, "1")
        print(f'  {{ id: {ts_string(lid)}, metro: {ts_string(metro)}, name: {ts_string(name)}, '
              f'short: {ts_string(short)}, mode: {ts_string(mode)}, color: {ts_string(color)}, '
              f'apiNames: {json.dumps(api)}, stationOrder: {json.dumps(order)}, '
              f'shape: {ts_coord_array(shape)} }},')
    print("];")

    # ------------------------------------------------------------------
    # Bus routes: skip everything already in the metro registry (L1, B1,
    # M1, T1-T5, D1, D2). Emit two things:
    #   1. BUS_ROUTES catalog (id, short, name, color) for the sidebar list
    #   2. A separate public/bus-routes.json with the heavy shape + stops
    #      payload, fetched lazily by the client.
    # ------------------------------------------------------------------
    metro_gtfs_ids = {gid for (gid, *_) in METRO_LINES}
    metro_gtfs_ids.update({"B2", "D1_BUS", "D2_BUS"})  # express + emergency-bus variants

    bus_catalog = []
    bus_payload = {}
    for rid, info in bus_routes.items():
        if rid in metro_gtfs_ids: continue
        if info["type"] != "3": continue  # GTFS route_type 3 = bus
        # Stops + shape come from the SAME representative trip so the line
        # actually passes through every rendered stop.
        trip = representative_trip(bus_trip_index, rid, "0") or representative_trip(bus_trip_index, rid, "1")
        if not trip: continue
        order = trip["stops"]
        shape = trip["shape"]
        if not order and not shape: continue
        # Catalog entry (no shape/stops, just headline metadata)
        bus_catalog.append({
            "id": rid,
            "short": info["short"],
            "name": info["name"],
            "color": info["color"],
        })
        # Payload entry (full geometry + stop list)
        bus_payload[rid] = {
            "shape": [[round(la, 5), round(lo, 5)] for (la, lo) in shape],
            "stops": [
                {
                    "id": sid,
                    "name": bus_stops[sid]["name"],
                    "lat": round(bus_stops[sid]["lat"], 5),
                    "lon": round(bus_stops[sid]["lon"], 5),
                }
                for sid in order if sid in bus_stops
            ],
        }

    bus_catalog.sort(key=lambda r: (
        # Numeric routes first by number, then everything else alphabetic
        (0, int(r["short"])) if r["short"].isdigit() else (1, r["short"]),
    ))

    # ------------------------------------------------------------------
    # Network graph for multi-modal trip planning. Combine rail + metro +
    # trolley + bus into one routable graph with walking transfers between
    # stops that are physically near each other. Client-side Dijkstra will
    # find direct + 1-transfer + 2-transfer trips across any pair of stops.
    # ------------------------------------------------------------------
    print("building network graph...", file=sys.stderr)
    import math

    # Average mode speeds in mph for time estimation. These are rough but
    # let the router rank options without timetable lookup.
    MODE_SPEED_MPH = {
        "rr": 30, "mfl": 22, "bsl": 22, "nhsl": 25,
        "trolley": 12, "girard": 12, "suburban-trolley": 18, "bus": 12,
    }

    network_stops = {}  # stop_id -> {id, name, lat, lon, modes: set, lineIds: set}
    network_routes = {}  # internal_line_id -> {color, mode, name, short, stops: [stop_ids]}

    def add_network_stop(canonical_id, name, lat, lon, mode, line_id):
        s = network_stops.setdefault(canonical_id, {
            "id": canonical_id, "name": name, "lat": lat, "lon": lon,
            "modes": set(), "lineIds": set(),
        })
        s["modes"].add(mode)
        s["lineIds"].add(line_id)

    # RR + metro: use the same Station ids we emit elsewhere so the UI can
    # link a graph node back to a rendered marker on the map.
    for cid, s in stations.items():
        lid = next(iter(s["lineIds"]))
        line_def = next((l for l in RR_LINES if l[0] == lid), None) \
                or next((l for l in METRO_LINES if l[1] == lid), None)
        if not line_def: continue
        # METRO_LINES tuple: (gtfs_id, internal_id, metro, name, short, mode, color, api)
        # RR_LINES tuple:    (internal_id, name, short, mode, color, api)
        for line_id in s["lineIds"]:
            mode = next((row[5] for row in METRO_LINES if row[1] == line_id), None) \
                or next((row[3] for row in RR_LINES if row[0] == line_id), None) \
                or "rr"
            add_network_stop(cid, s["name"], s["lat"], s["lon"], mode, line_id)

    for (lid, _name, _short, _mode, _color, _api) in RR_LINES:
        order = stops_for_route(rr_trip_index, lid, "0") or stops_for_route(rr_trip_index, lid, "1")
        network_routes[lid] = {
            "color": _color, "mode": "rr", "name": _name, "short": _short,
            "stops": [f"rr-{sid}" for sid in order if sid in rr_stops],
        }
    for (gid, lid, _metro, name, short, mode, color, _api) in METRO_LINES:
        order = stops_for_route(bus_trip_index, gid, "0") or stops_for_route(bus_trip_index, gid, "1")
        network_routes[lid] = {
            "color": color, "mode": mode, "name": name, "short": short,
            "stops": [f"m-{sid}" for sid in order if sid in bus_stops],
        }

    # Buses: include every bus stop and route. Big - thousands of stops -
    # but Dijkstra is fast and the graph compresses well in JSON.
    for rid, info in bus_routes.items():
        if rid in metro_gtfs_ids: continue
        if info["type"] != "3": continue
        trip = representative_trip(bus_trip_index, rid, "0") or representative_trip(bus_trip_index, rid, "1")
        if not trip: continue
        bright = brighten_color(info["color"])
        stop_ids_full = []
        for sid in trip["stops"]:
            if sid not in bus_stops: continue
            s = bus_stops[sid]
            cid = f"b-{sid}"
            add_network_stop(cid, s["name"], s["lat"], s["lon"], "bus", rid)
            stop_ids_full.append(cid)
        network_routes[f"BUS-{rid}"] = {
            "color": bright, "mode": "bus", "name": info["name"], "short": info["short"],
            "stops": stop_ids_full,
        }

    # Walking transfers: for each stop, find neighbors within 400m. Use a
    # coarse spatial hash (cells of ~500m) so this is O(N) not O(N^2) on
    # ~10k stops.
    print(f"  graph has {len(network_stops)} stops, {len(network_routes)} routes", file=sys.stderr)
    print("  computing walking transfers...", file=sys.stderr)
    TRANSFER_RADIUS_M = 400
    WALK_MPH = 3.0
    cell_deg = 500 / 111_111  # ~500m in degrees latitude
    grid = defaultdict(list)
    for cid, s in network_stops.items():
        cell = (int(s["lat"] / cell_deg), int(s["lon"] / cell_deg))
        grid[cell].append(cid)

    def haversine_m(la1, lo1, la2, lo2):
        R = 6_371_000
        p1, p2 = math.radians(la1), math.radians(la2)
        dp = math.radians(la2 - la1)
        dl = math.radians(lo2 - lo1)
        a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
        return 2 * R * math.asin(math.sqrt(a))

    transfers = []
    for cid, s in network_stops.items():
        ci, cj = int(s["lat"] / cell_deg), int(s["lon"] / cell_deg)
        # Check this cell + 8 neighbors
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for other in grid.get((ci + di, cj + dj), []):
                    if other <= cid: continue  # one direction; router uses both ways
                    o = network_stops[other]
                    # Skip if same stop or different modes that wouldn't realistically
                    # share a walking transfer (same-mode within 50m is the same physical
                    # platform; cross-mode within 400m is a real walk).
                    d = haversine_m(s["lat"], s["lon"], o["lat"], o["lon"])
                    if d > TRANSFER_RADIUS_M: continue
                    # Cost: meters / (WALK_MPH * 1609.34 / 60) = minutes
                    minutes = round(d / (WALK_MPH * 1609.34 / 60), 2)
                    transfers.append([cid, other, minutes])

    print(f"  {len(transfers)} walking transfers", file=sys.stderr)

    # Speeds map for client
    speeds = {k: v for k, v in MODE_SPEED_MPH.items()}

    network = {
        "stops": [
            {
                "id": s["id"],
                "name": s["name"],
                "lat": round(s["lat"], 5),
                "lon": round(s["lon"], 5),
                "modes": sorted(s["modes"]),
                "lineIds": sorted(s["lineIds"]),
            }
            for s in network_stops.values()
        ],
        "routes": network_routes,
        "transfers": transfers,
        "speeds": speeds,
    }

    network_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "network.json"))
    with open(network_path, "w") as f:
        json.dump(network, f, separators=(",", ":"))
    print(f"wrote {network_path}", file=sys.stderr)

    print()
    print("export const BUS_ROUTES = [")
    for r in bus_catalog:
        print(f'  {{ id: {ts_string(r["id"])}, short: {ts_string(r["short"])}, '
              f'name: {ts_string(r["name"])}, color: {ts_string(r["color"])} }},')
    print("];")

    # Write public/bus-routes.json
    out_path = os.path.join(os.path.dirname(__file__), "..", "public", "bus-routes.json")
    out_path = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(bus_payload, f, separators=(",", ":"))
    print(f"wrote {out_path} ({len(bus_payload)} routes)", file=sys.stderr)

    print(f"stations: {len(stations)}", file=sys.stderr)
    print(f"lines: {len(RR_LINES) + len(METRO_LINES)}", file=sys.stderr)
    print(f"bus routes: {len(bus_catalog)}", file=sys.stderr)


if __name__ == "__main__":
    main()
