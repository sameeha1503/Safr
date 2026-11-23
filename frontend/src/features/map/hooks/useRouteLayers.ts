import { useCallback, useEffect, useRef } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import {
  ORIGIN_MARKER_SVG,
  DESTINATION_MARKER_SVG,
  stepMarkerSvg,
  addArrowImage,
} from "@/lib/map-config";
import { routeColor } from "../lib/format";
import type { Hit } from "../lib/types";
import type { RouteStep, ScoredRoute as Scored } from "@/lib/maps.server";
import { useLatest } from "./useLatest";

export interface UseRouteLayersOptions {
  map: MapLibreMap | null;
  maplibre: typeof import("maplibre-gl") | null;
  ready: boolean;
  origin: { lat: number; lng: number };
  originLabel: string;
  isGpsOrigin: boolean;
  destination: Hit | null;
  waypoints: Hit[];
  routes: Scored[];
  selected: number;
  activeStepIndex: number | null;
  onFitBounds?: (() => void) | undefined;
  onDestinationDrag?: (point: { lat: number; lng: number }) => void;
}

export function useRouteLayers({
  map,
  maplibre,
  ready,
  origin,
  originLabel,
  isGpsOrigin,
  destination,
  waypoints,
  routes,
  selected,
  activeStepIndex,
  onFitBounds,
  onDestinationDrag,
}: UseRouteLayersOptions) {
  const originMarkerRef = useRef<MapLibreMarker | null>(null);
  const destMarkerRef = useRef<MapLibreMarker | null>(null);
  const stopMarkersRef = useRef<MapLibreMarker[]>([]);
  const stepMarkerRef = useRef<MapLibreMarker | null>(null);
  const hazardMarkersRef = useRef<MapLibreMarker[]>([]);

  const routesLatest = useLatest(routes);
  const selectedLatest = useLatest(selected);
  const activeStepIndexLatest = useLatest(activeStepIndex);
  const onFitBoundsLatest = useLatest(onFitBounds);
  const onDestinationDragLatest = useLatest(onDestinationDrag);

  const addRouteDataToMap = useCallback(() => {
    if (!map || !map.isStyleLoaded()) return;

    const curRoutes = routesLatest.current;
    const curSelected = selectedLatest.current;
    const curStepIdx = activeStepIndexLatest.current;

    // Clean up any existing route layers/sources
    for (let i = 0; i < 10; i++) {
      try {
        map.removeLayer(`safr-route-arrows-${i}`);
      } catch {
        /* ignore */
      }
      try {
        map.removeLayer(`safr-route-line-traveled-${i}`);
      } catch {
        /* ignore */
      }
      try {
        map.removeLayer(`safr-route-line-${i}`);
      } catch {
        /* ignore */
      }
      try {
        map.removeLayer(`safr-route-casing-${i}`);
      } catch {
        /* ignore */
      }
      try {
        map.removeSource(`safr-route-traveled-${i}`);
      } catch {
        /* ignore */
      }
      try {
        map.removeSource(`safr-route-${i}`);
      } catch {
        /* ignore */
      }
    }

    curRoutes
      .map((r, i) => ({ r, i }))
      .sort((a, b) => Number(a.i === curSelected) - Number(b.i === curSelected))
      .forEach(({ r, i }) => {
        if (!r.polyline) return;
        try {
          const pathCoords = JSON.parse(r.polyline) as [number, number][];
          if (!pathCoords || pathCoords.length === 0) return;

          const coords = pathCoords.map(
            ([lat, lng]) => [lng, lat] as [number, number],
          );
          const isSelected = i === curSelected;
          const color = routeColor(r.kind, isSelected);

          // If stepping through route, split into traveled and remaining
          let remainingCoords = coords;
          let traveledCoords: [number, number][] = [];

          if (
            isSelected &&
            curStepIdx !== null &&
            r.steps[curStepIdx]?.location
          ) {
            const stepLoc = r.steps[curStepIdx]!.location!;
            let closestIdx = 0;
            let minDist = Infinity;
            for (let cIdx = 0; cIdx < coords.length; cIdx++) {
              const d = Math.hypot(
                coords[cIdx]![0] - stepLoc[1],
                coords[cIdx]![1] - stepLoc[0],
              );
              if (d < minDist) {
                minDist = d;
                closestIdx = cIdx;
              }
            }
            if (closestIdx > 0) {
              traveledCoords = coords.slice(0, closestIdx + 1);
              remainingCoords = coords.slice(closestIdx);
            }
          }

          const sourceId = `safr-route-${i}`;
          const geojson: FeatureCollection = {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: remainingCoords },
              },
            ],
          };
          map.addSource(sourceId, { type: "geojson", data: geojson });

          // Casing (dark outline)
          map.addLayer({
            id: `safr-route-casing-${i}`,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": isSelected ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.1)",
              "line-width": isSelected ? 9 : 5,
              "line-opacity": isSelected ? 1 : 0.35,
            },
          });

          // Main line
          map.addLayer({
            id: `safr-route-line-${i}`,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": color,
              "line-width": isSelected ? 6 : 3.5,
              "line-opacity": isSelected ? 1 : 0.35,
            },
          });

          // Traveled progress line (muted color)
          if (traveledCoords.length >= 2) {
            const traveledSourceId = `safr-route-traveled-${i}`;
            map.addSource(traveledSourceId, {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: {},
                    geometry: {
                      type: "LineString",
                      coordinates: traveledCoords,
                    },
                  },
                ],
              },
            });
            map.addLayer({
              id: `safr-route-line-traveled-${i}`,
              type: "line",
              source: traveledSourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": "#64748b",
                "line-width": 5,
                "line-opacity": 0.7,
                "line-dasharray": [1.5, 1.5],
              },
            });
          }

          // Direction arrows on selected route
          if (isSelected) {
            addArrowImage(map);
            map.addLayer({
              id: `safr-route-arrows-${i}`,
              type: "symbol",
              source: sourceId,
              layout: {
                "symbol-placement": "line",
                "icon-image": "safr-route-arrow",
                "icon-size": 0.7,
                "icon-rotation-alignment": "map",
                "icon-allow-overlap": true,
                "symbol-spacing": 80,
              },
            });
          }
        } catch (e) {
          console.error("Failed to add route layer", e);
        }
      });
  }, [map, routesLatest, selectedLatest, activeStepIndexLatest]);

  // Update step marker helper
  const updateStepMarker = useCallback(
    (step: RouteStep, idx: number) => {
      if (!map || !maplibre || !step.location) return;
      const [lat, lng] = step.location;
      map.flyTo({ center: [lng, lat], zoom: 15 });

      stepMarkerRef.current?.remove();
      const el = document.createElement("div");
      el.innerHTML = stepMarkerSvg(idx + 1);

      const stepPopup = document.createElement("div");
      stepPopup.className = "text-xs font-semibold";
      stepPopup.textContent = `Step ${idx + 1}: ${step.instruction}`;

      stepMarkerRef.current = new maplibre.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([lng, lat])
        .setPopup(new maplibre.Popup({ offset: 16 }).setDOMContent(stepPopup))
        .addTo(map);
      stepMarkerRef.current.togglePopup();
    },
    [map, maplibre],
  );

  const clearStepMarker = useCallback(() => {
    stepMarkerRef.current?.remove();
    stepMarkerRef.current = null;
  }, []);

  // Synchronize markers on map whenever inputs change
  useEffect(() => {
    if (!ready || !map || !maplibre) return;

    // Clear old markers
    originMarkerRef.current?.remove();
    destMarkerRef.current?.remove();
    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];
    stepMarkerRef.current?.remove();
    originMarkerRef.current = null;
    destMarkerRef.current = null;
    stepMarkerRef.current = null;
    hazardMarkersRef.current.forEach((m) => m.remove());
    hazardMarkersRef.current = [];

    // 1. Origin marker
    const originEl = document.createElement("div");
    originEl.innerHTML = ORIGIN_MARKER_SVG;
    originEl.title = isGpsOrigin ? "You (Starting Point)" : "Starting Point";

    const originPopup = document.createElement("div");
    const oTitle = document.createElement("b");
    oTitle.textContent = isGpsOrigin
      ? "You (Starting Point)"
      : "Starting Point";
    const oSub = document.createElement("div");
    oSub.textContent = originLabel;
    originPopup.append(oTitle, oSub);

    originMarkerRef.current = new maplibre.Marker({
      element: originEl,
      anchor: "center",
    })
      .setLngLat([origin.lng, origin.lat])
      .setPopup(new maplibre.Popup({ offset: 16 }).setDOMContent(originPopup))
      .addTo(map);

    // 2. Waypoints numbered markers
    waypoints.forEach((w, idx) => {
      const stopEl = document.createElement("div");
      stopEl.style.cssText =
        "background-color:#0284c7;color:white;width:28px;height:28px;border-radius:50%;border:2.5px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;";
      stopEl.textContent = String(idx + 1);

      const stopPopup = document.createElement("div");
      const sTitle = document.createElement("b");
      sTitle.textContent = `Stop ${idx + 1}: ${w.name}`;
      const sAddr = document.createElement("div");
      sAddr.textContent = w.address;
      stopPopup.append(sTitle, sAddr);

      const marker = new maplibre.Marker({ element: stopEl, anchor: "center" })
        .setLngLat([w.lng, w.lat])
        .setPopup(new maplibre.Popup({ offset: 16 }).setDOMContent(stopPopup))
        .addTo(map);
      stopMarkersRef.current.push(marker);
    });

    // 3. Destination marker
    if (destination) {
      const destEl = document.createElement("div");
      destEl.innerHTML = DESTINATION_MARKER_SVG;
      destEl.title = destination.name;

      const destPopup = document.createElement("div");
      const dTitle = document.createElement("b");
      dTitle.textContent = destination.name;
      const dSub = document.createElement("div");
      dSub.textContent = destination.address;
      destPopup.append(dTitle, dSub);

      destMarkerRef.current = new maplibre.Marker({
        element: destEl,
        anchor: "bottom",
        draggable: true,
      })
        .setLngLat([destination.lng, destination.lat])
        .setPopup(new maplibre.Popup({ offset: 24 }).setDOMContent(destPopup))
        .addTo(map);
      destMarkerRef.current.on("dragend", () => {
        const point = destMarkerRef.current?.getLngLat();
        if (point)
          onDestinationDragLatest.current?.({ lat: point.lat, lng: point.lng });
      });
    }

    // 4. Hazard zone markers for the selected route
    const selectedRoute = routes[selected];
    (selectedRoute?.hazardZones ?? []).forEach((zone) => {
      const zoneEl = document.createElement("div");
      zoneEl.style.cssText =
        "background-color:#f59e0b;color:white;width:26px;height:26px;border-radius:50%;border:2.5px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;";
      zoneEl.textContent = "!";
      zoneEl.title = zone.label;

      const zonePopup = document.createElement("div");
      const zTitle = document.createElement("b");
      zTitle.textContent = `⚠ ${zone.label}`;
      const zDesc = document.createElement("div");
      zDesc.textContent = zone.description;
      const zLink = document.createElement("a");
      zLink.href = zone.source_url;
      zLink.target = "_blank";
      zLink.rel = "noopener noreferrer";
      zLink.textContent = "Source";
      zLink.style.cssText =
        "text-decoration:underline;display:block;margin-top:4px;";
      zonePopup.append(zTitle, zDesc, zLink);

      const marker = new maplibre.Marker({ element: zoneEl, anchor: "center" })
        .setLngLat([zone.lng, zone.lat])
        .setPopup(new maplibre.Popup({ offset: 16 }).setDOMContent(zonePopup))
        .addTo(map);
      hazardMarkersRef.current.push(marker);
    });

    addRouteDataToMap();

    if (destination || routes.length > 0) {
      onFitBoundsLatest.current?.();
    }
  }, [
    ready,
    map,
    maplibre,
    origin,
    destination,
    waypoints,
    routes,
    selected,
    originLabel,
    isGpsOrigin,
    addRouteDataToMap,
    onFitBoundsLatest,
    onDestinationDragLatest,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      originMarkerRef.current?.remove();
      destMarkerRef.current?.remove();
      stopMarkersRef.current.forEach((m) => m.remove());
      stepMarkerRef.current?.remove();
      hazardMarkersRef.current.forEach((m) => m.remove());
    };
  }, []);

  return {
    addRouteDataToMap,
    updateStepMarker,
    clearStepMarker,
  };
}
