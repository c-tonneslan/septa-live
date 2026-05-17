"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Train, Vehicle } from "@/lib/septa";
import type { Station } from "@/data/stations";
import { lines } from "@/data/lines";
import type { Selection } from "./App";

// Center on City Hall with a zoom that covers Trenton, Newark DE, Doylestown,
// Thorndale - the regional rail's outer bounds.
const CENTER: [number, number] = [40.005, -75.16];
const INITIAL_ZOOM = 10;

// RR Center City hub stations and 69th St / Frankford / Norristown — the
// terminal-class stations that get a slightly larger marker so they pop on
// the map.
const HUB_IDS = new Set([
  "rr-90004", "rr-90005", "rr-90006", "rr-90007", // 30th, Suburban, Jefferson, Temple
  "m-416", "m-61", "m-31790", "m-30520",          // 69th St TC (MFL), Frankford TC, 69th NHSL, Norristown TC
  "m-1281", "m-152", "m-20965",                   // City Hall BSL, NRG, Fern Rock
]);

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
    html: `<div class="${cls}" style="background:${t.lineColor};${ring}">${t.id}</div>`,
    iconSize: [32, 22],
    iconAnchor: [16, 11],
  });
}

function vehicleIcon(v: Vehicle, selected: boolean): L.DivIcon {
  const late = v.lateMinutes >= 5;
  const ring = selected ? "outline: 2px solid #facc15; outline-offset: 2px;" : "";
  const lateRing = late ? "box-shadow: 0 0 0 2px rgba(239,68,68,0.7);" : "";
  return L.divIcon({
    className: "",
    html: `<div class="vehicle-marker" style="background:${v.lineColor};${ring}${lateRing}">${v.lineShort ?? ""}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
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
  selection: Selection;
  onSelect: (s: Selection) => void;
}

export default function MapView({
  trains,
  vehicles,
  stations,
  enabledLines,
  selection,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const stationLayerRef = useRef<L.LayerGroup | null>(null);
  const trainLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const trainMarkers = useRef<Map<string, L.Marker>>(new Map());
  const vehicleMarkers = useRef<Map<string, L.Marker>>(new Map());

  // one-time init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: CENTER,
      zoom: INITIAL_ZOOM,
      zoomControl: true,
      preferCanvas: true,
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
    // Z-ordering: polylines (bottom), stations, vehicles, trains (top).
    polylineLayerRef.current = L.layerGroup().addTo(map);
    stationLayerRef.current = L.layerGroup().addTo(map);
    vehicleLayerRef.current = L.layerGroup().addTo(map);
    trainLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      polylineLayerRef.current = null;
      stationLayerRef.current = null;
      trainLayerRef.current = null;
      vehicleLayerRef.current = null;
      trainMarkers.current.clear();
      vehicleMarkers.current.clear();
    };
  }, []);

  // polylines per enabled line, using GTFS shape geometry so the lines trace
  // the actual track / street, not just station-to-station straight cuts.
  useEffect(() => {
    const layer = polylineLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const line of lines) {
      if (!enabledLines.has(line.id)) continue;
      if (line.shape.length < 2) continue;
      const weight = line.mode === "rr" ? 2.5 : line.mode === "trolley" || line.mode === "suburban-trolley" ? 3 : 4;
      const opacity = line.mode === "rr" ? 0.75 : 0.9;
      L.polyline(line.shape, {
        color: line.color,
        weight,
        opacity,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layer);
    }
  }, [enabledLines]);

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
        existing.setLatLng([t.lat, t.lon]);
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
      }
    }
  }, [trains, selection, onSelect]);

  // transit vehicle markers (BSL/MFL/NHSL/trolleys)
  useEffect(() => {
    const layer = vehicleLayerRef.current;
    if (!layer) return;
    const seen = new Set<string>();
    for (const v of vehicles) {
      if (!v.lineId || !enabledLines.has(v.lineId)) continue;
      seen.add(v.id);
      const selected = selection?.kind === "vehicle" && selection.id === v.id;
      const existing = vehicleMarkers.current.get(v.id);
      if (existing) {
        existing.setLatLng([v.lat, v.lon]);
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
      }
    }
  }, [vehicles, enabledLines, selection, onSelect]);

  // fly to selection
  useEffect(() => {
    if (!mapRef.current || !selection) return;
    if (selection.kind === "train") {
      const t = trains.find((x) => x.id === selection.id);
      if (t && Number.isFinite(t.lat) && Number.isFinite(t.lon)) {
        mapRef.current.flyTo([t.lat, t.lon], Math.max(mapRef.current.getZoom(), 12), { duration: 0.6 });
      }
    } else if (selection.kind === "vehicle") {
      const v = vehicles.find((x) => x.id === selection.id);
      if (v) {
        mapRef.current.flyTo([v.lat, v.lon], Math.max(mapRef.current.getZoom(), 13), { duration: 0.6 });
      }
    } else if (selection.kind === "station") {
      const s = stations.find((x) => x.id === selection.id);
      if (s) {
        mapRef.current.flyTo([s.lat, s.lon], Math.max(mapRef.current.getZoom(), 13), { duration: 0.6 });
      }
    }
  }, [selection, trains, vehicles, stations]);

  return <div ref={containerRef} className="h-full w-full" />;
}
