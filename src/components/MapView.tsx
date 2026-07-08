"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Train, Vehicle } from "@/lib/septa";
import type { Station } from "@/data/stations";
import { lines } from "@/data/lines";
import { lookupBusRoute, type BusRouteData } from "@/data/buses";
import type { Trip } from "@/lib/router";
import type { Selection } from "./App";

// Center on City Hall with a zoom that covers Trenton, Newark DE, Doylestown,
// Thorndale - the regional rail's outer bounds.
const CENTER: [number, number] = [40.005, -75.16];
const INITIAL_ZOOM = 10;
// Below this zoom the individual bus/trolley dots are hidden (declutter the
// region-wide frame); they reveal as you zoom into a neighborhood.
const VEHICLE_MIN_ZOOM = 12;

// RR Center City hub stations and 69th St / Frankford / Norristown — the
// terminal-class stations that get a slightly larger marker so they pop on
// the map.
const HUB_IDS = new Set([
  "rr-90004", "rr-90005", "rr-90006", "rr-90007", // 30th, Suburban, Jefferson, Temple
  "m-416", "m-61", "m-31790", "m-30520",          // 69th St TC (MFL), Frankford TC, 69th NHSL, Norristown TC
  "m-1281", "m-152", "m-20965",                   // City Hall BSL, NRG, Fern Rock
]);

// Pick black or white text for legibility on an arbitrary line color (WCAG-ish
// relative luminance). Hardcoded black text vanished on the #000000 line and on
// dark navy/maroon; hardcoded white was illegible on the yellow/white trolleys.
function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#0b0f14" : "#ffffff";
}

// A very dark line color would leave the marker border invisible on the dark
// basemap; brighten the outline in that case so the pill still separates.
function markerBorder(hex: string): string {
  return contrastText(hex) === "#ffffff" ? "rgba(255,255,255,0.35)" : "rgba(11,15,20,0.9)";
}

function trainIcon(t: Train, selected: boolean): L.DivIcon {
  const cls =
    t.lateMinutes >= 10
      ? "train-marker very-late"
      : t.lateMinutes >= 3
        ? "train-marker late"
        : "train-marker";
  const ring = selected ? "outline: 2px solid #facc15; outline-offset: 2px;" : "";
  return L.divIcon({
    className: "",
    html: `<div class="${cls}" style="background:${t.lineColor};color:${contrastText(t.lineColor)};border-color:${markerBorder(t.lineColor)};${ring}">${t.id}</div>`,
    iconSize: [32, 22],
    iconAnchor: [16, 11],
  });
}

function vehicleIcon(v: Vehicle, selected: boolean): L.DivIcon {
  // Same delay vocabulary as trains: amber ring 3–9, red ring 10+.
  const lateRing =
    v.lateMinutes >= 10
      ? "box-shadow: 0 0 0 2px var(--late-severe);"
      : v.lateMinutes >= 3
        ? "box-shadow: 0 0 0 2px var(--late);"
        : "";
  const ring = selected ? "outline: 2px solid #facc15; outline-offset: 2px;" : "";
  return L.divIcon({
    className: "",
    html: `<div class="vehicle-marker" style="background:${v.lineColor};color:${contrastText(v.lineColor)};border-color:${markerBorder(v.lineColor)};${ring}${lateRing}">${v.lineShort ?? ""}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// Fly to a point, but on phones shift the center south so the target rises above
// the bottom sheet (which covers ~half the screen) instead of landing under it.
function flyToPoint(map: L.Map, latlon: [number, number], minZoom: number) {
  const zoom = Math.max(map.getZoom(), minZoom);
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  if (isMobile) {
    const inset = map.getSize().y * 0.5; // sheet auto-pops to ~half on select
    const shifted = map.project(latlon, zoom).add([0, inset / 2]);
    map.flyTo(map.unproject(shifted, zoom), zoom, { duration: 0.6 });
  } else {
    map.flyTo(latlon, zoom, { duration: 0.6 });
  }
}

function stationIcon(s: Station): L.DivIcon {
  const hub = HUB_IDS.has(s.id) ? " is-hub" : "";
  return L.divIcon({
    className: "",
    html: `<div class="station-marker${hub}"></div>`,
    iconSize: HUB_IDS.has(s.id) ? [14, 14] : [10, 10],
    iconAnchor: HUB_IDS.has(s.id) ? [7, 7] : [5, 5],
  });
}

interface Props {
  trains: Train[];
  vehicles: Vehicle[];
  stations: Station[];
  enabledLines: Set<string>;
  busData: Map<string, BusRouteData>;
  trip: Trip | null;
  selection: Selection;
  onSelect: (s: Selection) => void;
}

export default function MapView({
  trains,
  vehicles,
  stations,
  enabledLines,
  busData,
  trip,
  selection,
  onSelect,
}: Props) {
  // When a vehicle/train is selected, dim every other line so its route pops.
  const highlightedLineId = (() => {
    if (!selection) return null;
    if (selection.kind === "train") return trains.find((t) => t.id === selection.id)?.lineId ?? null;
    if (selection.kind === "vehicle") return vehicles.find((v) => v.id === selection.id)?.lineId ?? null;
    return null;
  })();
  const highlightedBusRouteId = (() => {
    if (!selection || selection.kind !== "vehicle") return null;
    return vehicles.find((v) => v.id === selection.id)?.routeId ?? null;
  })();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const busPolylineLayerRef = useRef<L.LayerGroup | null>(null);
  const busStopLayerRef = useRef<L.LayerGroup | null>(null);
  const tripLayerRef = useRef<L.LayerGroup | null>(null);
  const stationLayerRef = useRef<L.LayerGroup | null>(null);
  const trainLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const trainMarkers = useRef<Map<string, L.Marker>>(new Map());
  const vehicleMarkers = useRef<Map<string, L.Marker>>(new Map());
  // Tween state: between SEPTA polls (15s apart), interpolate each marker
  // from its last known position toward the new one so trains/buses glide
  // instead of jumping. A single RAF loop processes every active tween.
  const tweens = useRef<Map<string, { marker: L.Marker; fromLat: number; fromLon: number; toLat: number; toLon: number; start: number; duration: number }>>(new Map());
  // Last target each marker is already tweening toward, so re-running a marker
  // effect for a non-position reason (e.g. selection changed) doesn't restart an
  // in-flight tween from its current interpolated position (which made markers
  // stall and creep).
  const tweenTargets = useRef<Map<string, [number, number]>>(new Map());
  const rafRef = useRef<number | null>(null);

  const startTickLoop = () => {
    if (rafRef.current !== null) return;
    const tick = () => {
      const now = performance.now();
      const tw = tweens.current;
      if (tw.size === 0) {
        rafRef.current = null;
        return;
      }
      for (const [id, t] of tw) {
        const p = Math.min(1, (now - t.start) / t.duration);
        const lat = t.fromLat + (t.toLat - t.fromLat) * p;
        const lon = t.fromLon + (t.toLon - t.fromLon) * p;
        t.marker.setLatLng([lat, lon]);
        if (p >= 1) tw.delete(id);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const tweenMarkerTo = (id: string, marker: L.Marker, to: [number, number], duration = 14_500) => {
    // Already heading to this exact target — don't restart the tween.
    const prevTarget = tweenTargets.current.get(id);
    if (prevTarget && prevTarget[0] === to[0] && prevTarget[1] === to[1]) return;
    tweenTargets.current.set(id, to);
    const from = marker.getLatLng();
    if (from.lat === to[0] && from.lng === to[1]) return;
    tweens.current.set(id, {
      marker,
      fromLat: from.lat,
      fromLon: from.lng,
      toLat: to[0],
      toLon: to[1],
      start: performance.now(),
      duration,
    });
    startTickLoop();
  };

  // one-time init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: CENTER,
      zoom: INITIAL_ZOOM,
      zoomControl: true,
      preferCanvas: true,
      // Keep the user in the SEPTA region — no zooming out to the whole globe or
      // panning into the open ocean with no way back.
      minZoom: 8,
      maxBounds: L.latLngBounds([39.2, -76.5], [40.7, -74.1]),
      maxBoundsViscosity: 0.6,
    });
    L.tileLayer(
      "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://carto.com/attributions">CARTO</a> · data: SEPTA',
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(map);
    mapRef.current = map;
    // Z-ordering, bottom to top: bus polylines, rail polylines, trip overlay,
    // bus stops, rail stations, transit vehicles, RR trains.
    busPolylineLayerRef.current = L.layerGroup().addTo(map);
    polylineLayerRef.current = L.layerGroup().addTo(map);
    tripLayerRef.current = L.layerGroup().addTo(map);
    busStopLayerRef.current = L.layerGroup().addTo(map);
    stationLayerRef.current = L.layerGroup().addTo(map);
    vehicleLayerRef.current = L.layerGroup().addTo(map);
    trainLayerRef.current = L.layerGroup().addTo(map);

    // Zoom-tier the clutter: at region-wide zoom the hundreds of bus/trolley
    // dots are noise, so hide them until the user zooms into a neighborhood.
    // Trains, stations, and line shapes (the RR skeleton) stay visible.
    const applyZoomTiers = () => {
      const vl = vehicleLayerRef.current;
      if (!vl) return;
      const show = map.getZoom() >= VEHICLE_MIN_ZOOM;
      if (show && !map.hasLayer(vl)) map.addLayer(vl);
      else if (!show && map.hasLayer(vl)) map.removeLayer(vl);
    };
    applyZoomTiers();
    map.on("zoomend", applyZoomTiers);

    return () => {
      map.remove();
      mapRef.current = null;
      polylineLayerRef.current = null;
      busPolylineLayerRef.current = null;
      busStopLayerRef.current = null;
      tripLayerRef.current = null;
      stationLayerRef.current = null;
      trainLayerRef.current = null;
      vehicleLayerRef.current = null;
      trainMarkers.current.clear();
      vehicleMarkers.current.clear();
      tweens.current.clear();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // polylines per enabled line, using GTFS shape geometry so the lines trace
  // the actual track / street, not just station-to-station straight cuts.
  useEffect(() => {
    const layer = polylineLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    const anyHighlight = highlightedLineId !== null || highlightedBusRouteId !== null;
    for (const line of lines) {
      if (!enabledLines.has(line.id)) continue;
      if (line.shape.length < 2) continue;
      const isHighlighted = line.id === highlightedLineId;
      const baseWeight = line.mode === "rr" ? 2.5 : line.mode === "trolley" || line.mode === "suburban-trolley" ? 3 : 4;
      const baseOpacity = line.mode === "rr" ? 0.75 : 0.9;
      const weight = anyHighlight && isHighlighted ? baseWeight + 1.5 : baseWeight;
      const opacity = anyHighlight ? (isHighlighted ? 1 : 0.18) : baseOpacity;
      L.polyline(line.shape, {
        color: line.color,
        weight,
        opacity,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layer);
    }
  }, [enabledLines, highlightedLineId, highlightedBusRouteId]);

  // trip overlay: heavy line tracing the trip the user planned, with leg
  // boundary markers at each board/alight.
  useEffect(() => {
    const layer = tripLayerRef.current;
    const map = mapRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!trip) return;
    const allPoints: [number, number][] = [];
    for (const leg of trip.legs) {
      const points: [number, number][] = leg.kind === "ride"
        ? leg.stops.map((s) => [s.lat, s.lon])
        : [[leg.fromStop.lat, leg.fromStop.lon], [leg.toStop.lat, leg.toStop.lon]];
      allPoints.push(...points);
      L.polyline(points, {
        color: leg.kind === "ride" ? leg.routeColor : "#a3a3a3",
        weight: 6,
        opacity: 0.9,
        dashArray: leg.kind === "walk" ? "6 6" : undefined,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layer);
      L.circleMarker([leg.fromStop.lat, leg.fromStop.lon], {
        radius: 6, color: "#0b0f14", fillColor: "#facc15", fillOpacity: 1, weight: 2,
      })
        .bindTooltip(leg.fromStop.name)
        .addTo(layer);
    }
    const last = trip.legs[trip.legs.length - 1];
    if (last) {
      L.circleMarker([last.toStop.lat, last.toStop.lon], {
        radius: 7, color: "#0b0f14", fillColor: "#34d399", fillOpacity: 1, weight: 2,
      })
        .bindTooltip(last.toStop.name)
        .addTo(layer);
    }
    // Fit map to the trip bounds with a little padding so the whole route is visible.
    if (map && allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [trip]);

  // bus polylines + stops, lazy-rendered for whatever routes the user has enabled
  useEffect(() => {
    const polyLayer = busPolylineLayerRef.current;
    const stopLayer = busStopLayerRef.current;
    if (!polyLayer || !stopLayer) return;
    polyLayer.clearLayers();
    stopLayer.clearLayers();
    const anyHighlight = highlightedLineId !== null || highlightedBusRouteId !== null;
    for (const [routeId, data] of busData) {
      const route = lookupBusRoute(routeId);
      const color = route?.color ?? "#F59E0B";
      const isHighlighted = routeId === highlightedBusRouteId;
      const opacity = anyHighlight ? (isHighlighted ? 1 : 0.18) : 0.9;
      const weight = anyHighlight && isHighlighted ? 5 : 3.5;
      if (data.shape.length >= 2) {
        L.polyline(data.shape, {
          color,
          weight,
          opacity,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(polyLayer);
      }
      for (const stop of data.stops) {
        const m = L.circleMarker([stop.lat, stop.lon], {
          radius: 3,
          color,
          fillColor: color,
          fillOpacity: anyHighlight && !isHighlighted ? 0.25 : 0.9,
          weight: 1,
          opacity: anyHighlight && !isHighlighted ? 0.3 : 1,
        });
        m.bindTooltip(`${route?.short ?? routeId} · ${stop.name}`, {
          direction: "top",
          offset: [0, -4],
        });
        m.addTo(stopLayer);
      }
    }
  }, [busData, highlightedLineId, highlightedBusRouteId]);

  // station markers
  useEffect(() => {
    const layer = stationLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const s of stations) {
      const m = L.marker([s.lat, s.lon], { icon: stationIcon(s) });
      m.bindTooltip(s.name, { direction: "top", offset: [0, -6] });
      m.on("click", () => onSelect({ kind: "station", id: s.id }));
      layer.addLayer(m);
    }
  }, [stations, onSelect]);

  // RR train markers (reuse instances across polls so they slide instead of flicker)
  useEffect(() => {
    const layer = trainLayerRef.current;
    if (!layer) return;
    const seen = new Set<string>();
    for (const t of trains) {
      if (!Number.isFinite(t.lat) || !Number.isFinite(t.lon)) continue;
      seen.add(t.id);
      const selected = selection?.kind === "train" && selection.id === t.id;
      const existing = trainMarkers.current.get(t.id);
      if (existing) {
        tweenMarkerTo(`t-${t.id}`, existing, [t.lat, t.lon]);
        existing.setIcon(trainIcon(t, selected));
      } else {
        const m = L.marker([t.lat, t.lon], { icon: trainIcon(t, selected) });
        m.bindTooltip(
          `Train ${t.id} · ${t.lineShort ?? t.line} → ${t.destination}` +
            (t.lateMinutes > 0 ? ` · ${t.lateMinutes}m late` : ""),
          { direction: "top", offset: [0, -10] },
        );
        m.on("click", () => onSelect({ kind: "train", id: t.id }));
        m.addTo(layer);
        trainMarkers.current.set(t.id, m);
      }
    }
    for (const [id, marker] of trainMarkers.current) {
      if (!seen.has(id)) {
        layer.removeLayer(marker);
        trainMarkers.current.delete(id);
        tweens.current.delete(`t-${id}`);
        tweenTargets.current.delete(`t-${id}`);
      }
    }
  }, [trains, selection, onSelect]);

  // transit vehicle markers (BSL/MFL/NHSL/trolleys/buses).
  // The parent already filtered visibility (enabledLines for rail/trolley,
  // enabledBusRoutes for buses), so just render whatever's in `vehicles`.
  useEffect(() => {
    const layer = vehicleLayerRef.current;
    if (!layer) return;
    const seen = new Set<string>();
    for (const v of vehicles) {
      seen.add(v.id);
      const selected = selection?.kind === "vehicle" && selection.id === v.id;
      const existing = vehicleMarkers.current.get(v.id);
      if (existing) {
        tweenMarkerTo(`v-${v.id}`, existing, [v.lat, v.lon]);
        existing.setIcon(vehicleIcon(v, selected));
      } else {
        const m = L.marker([v.lat, v.lon], { icon: vehicleIcon(v, selected) });
        m.bindTooltip(
          `${v.lineShort ?? v.rawRouteId} · ${v.label} → ${v.destination}` +
            (v.lateMinutes > 0 ? ` · ${v.lateMinutes}m late` : ""),
          { direction: "top", offset: [0, -8] },
        );
        m.on("click", () => onSelect({ kind: "vehicle", id: v.id }));
        m.addTo(layer);
        vehicleMarkers.current.set(v.id, m);
      }
    }
    for (const [id, marker] of vehicleMarkers.current) {
      if (!seen.has(id)) {
        layer.removeLayer(marker);
        vehicleMarkers.current.delete(id);
        tweens.current.delete(`v-${id}`);
        tweenTargets.current.delete(`v-${id}`);
      }
    }
  }, [vehicles, selection, onSelect]);

  // Fly to a selection ONCE, when the user picks something — not on every 15s
  // poll or line toggle. The effect depends on trains/vehicles/stations (to read
  // fresh coordinates), but those change identity each poll, so guard on the
  // selection identity and only fly when it actually changes.
  const lastFlown = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selection) { lastFlown.current = null; return; }
    const key = `${selection.kind}:${selection.id}`;
    if (key === lastFlown.current) return; // a data refresh, not a new selection
    let flew = false;
    if (selection.kind === "train") {
      const t = trains.find((x) => x.id === selection.id);
      if (t && Number.isFinite(t.lat) && Number.isFinite(t.lon)) {
        flyToPoint(map, [t.lat, t.lon], 12);
        flew = true;
      }
    } else if (selection.kind === "vehicle") {
      const v = vehicles.find((x) => x.id === selection.id);
      if (v) {
        flyToPoint(map, [v.lat, v.lon], 13);
        flew = true;
      }
    } else if (selection.kind === "station") {
      const s = stations.find((x) => x.id === selection.id);
      if (s) {
        flyToPoint(map, [s.lat, s.lon], 13);
        flew = true;
      }
    }
    // Only record it as flown once we actually had coordinates, so a selection
    // made before its data arrives still flies on the next poll.
    if (flew) lastFlown.current = key;
  }, [selection, trains, vehicles, stations]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="application"
      aria-label="Live SEPTA system map. Use the sidebar to filter lines, search stations, and view live train and vehicle details."
    />
  );
}
