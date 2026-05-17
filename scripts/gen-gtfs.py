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


def longest_shape_per_route(trips_text, shapes):
    by_route = defaultdict(set)
    for row in read(trips_text):
        by_route[row["route_id"]].add(row["shape_id"])
    return {
        rid: shapes.get(max(sids, key=lambda s: len(shapes.get(s, []))), [])
        for rid, sids in by_route.items()
    }


def stops_for_route(trips_text, stop_times_text, route_id, direction="0"):
    trip_to_route = {}
    trip_dir = {}
    for row in read(trips_text):
        trip_to_route[row["trip_id"]] = row["route_id"]
        trip_dir[row["trip_id"]] = row.get("direction_id", "0")
    by_trip = defaultdict(list)
    for row in read(stop_times_text):
        if trip_to_route.get(row["trip_id"]) != route_id: continue
        if trip_dir.get(row["trip_id"]) != direction: continue
        try:
            by_trip[row["trip_id"]].append((int(row["stop_sequence"]), row["stop_id"]))
        except (ValueError, KeyError):
            pass
    if not by_trip: return []
    best = max(by_trip.values(), key=len)
    return [sid for _, sid in sorted(best)]


def is_trolley_street_stop(name):
    """Trolley street-running stops look like 'Baltimore Av & 51st St'; drop
    those from the marker layer so the map isn't littered with every-block
    stops. The route polylines still trace the real street geometry."""
    if " & " in name or "&" in name: return True
    if name.endswith(" - FS") or name.endswith(" - MBFS"): return True
    return False


def ts_string(s):
    return json.dumps(s)


def ts_coord_array(coords):
    return "[" + ",".join(f"[{a:.5f},{b:.5f}]" for a, b in coords) + "]"


def main():
    feeds = fetch_gtfs()

    rr_stops = load_stops(feeds["rail"]["stops.txt"])
    rr_shapes = load_shapes(feeds["rail"]["shapes.txt"])
    rr_route_shape = longest_shape_per_route(feeds["rail"]["trips.txt"], rr_shapes)

    bus_stops = load_stops(feeds["bus"]["stops.txt"])
    bus_shapes = load_shapes(feeds["bus"]["shapes.txt"])
    bus_route_shape = longest_shape_per_route(feeds["bus"]["trips.txt"], bus_shapes)

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
        order = stops_for_route(feeds["rail"]["trips.txt"], feeds["rail"]["stop_times.txt"], lid, "0")
        if not order:
            order = stops_for_route(feeds["rail"]["trips.txt"], feeds["rail"]["stop_times.txt"], lid, "1")
        out = []
        for sid in order:
            if sid not in rr_stops: continue
            cid = f"rr-{sid}"
            s = rr_stops[sid]
            add(cid, s["name"], s["lat"], s["lon"], lid)
            out.append(cid)
        station_order_by_line[lid] = out

    for (gid, lid, _metro, _name, _short, mode, _color, _api) in METRO_LINES:
        order = stops_for_route(feeds["bus"]["trips.txt"], feeds["bus"]["stop_times.txt"], gid, "0")
        if not order:
            order = stops_for_route(feeds["bus"]["trips.txt"], feeds["bus"]["stop_times.txt"], gid, "1")
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
        shape = rr_route_shape.get(lid, [])
        print(f'  {{ id: {ts_string(lid)}, name: {ts_string(name)}, short: {ts_string(short)}, '
              f'mode: {ts_string(mode)}, color: {ts_string(color)}, '
              f'apiNames: {json.dumps(api)}, stationOrder: {json.dumps(order)}, '
              f'shape: {ts_coord_array(shape)} }},')
    for (gid, lid, metro, name, short, mode, color, api) in METRO_LINES:
        order = station_order_by_line.get(lid, [])
        shape = bus_route_shape.get(gid, [])
        print(f'  {{ id: {ts_string(lid)}, metro: {ts_string(metro)}, name: {ts_string(name)}, '
              f'short: {ts_string(short)}, mode: {ts_string(mode)}, color: {ts_string(color)}, '
              f'apiNames: {json.dumps(api)}, stationOrder: {json.dumps(order)}, '
              f'shape: {ts_coord_array(shape)} }},')
    print("];")

    print(f"stations: {len(stations)}", file=sys.stderr)
    print(f"lines: {len(RR_LINES) + len(METRO_LINES)}", file=sys.stderr)


if __name__ == "__main__":
    main()
