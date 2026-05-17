"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Train } from "@/lib/septa";
import type { Station } from "@/data/stations";
import type { Selection } from "./App";

// Center on City Hall with a zoom that covers Trenton, Newark DE, Doylestown,
// Thorndale - the regional rail's outer bounds.
const CENTER: [number, number] = [40.005, -75.16];
const INITIAL_ZOOM = 10;

const HUB_IDS = new Set(["30th-st", "suburban", "jefferson", "temple-u"]);

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
  stations: Station[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}

export default function MapView({ trains, stations, selection, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const trainLayerRef = useRef<L.LayerGroup | null>(null);
  const stationLayerRef = useRef<L.LayerGroup | null>(null);
  const trainMarkers = useRef<Map<string, L.Marker>>(new Map());

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
    trainLayerRef.current = L.layerGroup().addTo(map);
    stationLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      trainLayerRef.current = null;
      stationLayerRef.current = null;
      trainMarkers.current.clear();
    };
  }, []);

  // station markers (only redraw when the visible set actually changes)
  useEffect(() => {
    const layer = stationLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const s of stations) {
      const m = L.marker([s.lat, s.lon], { icon: stationIcon(s) });
      m.bindTooltip(s.name, { direction: "top", offset: [0, -6], className: "" });
      m.on("click", () => onSelect({ kind: "station", id: s.id }));
      layer.addLayer(m);
    }
  }, [stations, onSelect]);

  // train markers (reuse marker instances across polls to avoid the redraw flicker)
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
    // remove markers for trains that have dropped out of the feed
    for (const [id, marker] of trainMarkers.current) {
      if (!seen.has(id)) {
        layer.removeLayer(marker);
        trainMarkers.current.delete(id);
      }
    }
  }, [trains, selection, onSelect]);

  // recenter the map when the user picks a train from the sidebar
  useEffect(() => {
    if (!mapRef.current || !selection) return;
    if (selection.kind === "train") {
      const t = trains.find((x) => x.id === selection.id);
      if (t && Number.isFinite(t.lat) && Number.isFinite(t.lon)) {
        mapRef.current.flyTo([t.lat, t.lon], Math.max(mapRef.current.getZoom(), 12), {
          duration: 0.6,
        });
      }
    } else if (selection.kind === "station") {
      const s = stations.find((x) => x.id === selection.id);
      if (s) {
        mapRef.current.flyTo([s.lat, s.lon], Math.max(mapRef.current.getZoom(), 13), {
          duration: 0.6,
        });
      }
    }
  }, [selection, trains, stations]);

  return <div ref={containerRef} className="h-full w-full" />;
}
