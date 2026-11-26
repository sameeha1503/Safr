import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import {
  featureToPickedPlace,
  type PickedPlace,
  type RawFeatureLike,
} from "../lib/place-picking";

export const CANDIDATE_SYMBOL_LAYERS = [
  "poi_r20",
  "poi_r7",
  "poi_r1",
  "poi_transit",
  "airport",
  "label_other",
  "label_village",
  "label_town",
  "label_city",
  "label_state",
  "label_city_capital",
  "water_name_point_label",
  "water_name_line_label",
  "highway-name-major",
  "highway-name-minor",
  "highway-name-path",
];

const RASTER_HINT_SESSION_KEY = "safr_raster_places_hint_dismissed";

export interface UsePlacePickerOptions {
  map: MapLibreMap | null;
  maplibre?: typeof import("maplibre-gl") | null;
  isVector?: boolean;
  onPlacePick?: (place: PickedPlace) => void;
  onDismiss?: () => void;
}

export function usePlacePicker({
  map,
  maplibre,
  isVector = true,
  onPlacePick,
  onDismiss,
}: UsePlacePickerOptions) {
  const [pickedPlace, setPickedPlace] = useState<PickedPlace | null>(null);
  const [showRasterChip, setShowRasterChip] = useState(false);

  const highlightMarkerRef = useRef<MapLibreMarker | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const onPlacePickRef = useRef(onPlacePick);
  onPlacePickRef.current = onPlacePick;

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const clearPickedPlace = useCallback(() => {
    setPickedPlace(null);
    if (highlightMarkerRef.current) {
      highlightMarkerRef.current.remove();
      highlightMarkerRef.current = null;
    }
    onDismissRef.current?.();
  }, []);

  const dismissRasterChip = useCallback(() => {
    setShowRasterChip(false);
    try {
      sessionStorage.setItem(RASTER_HINT_SESSION_KEY, "true");
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  // Sync raster hint chip visibility once per session
  useEffect(() => {
    if (isVector) {
      setShowRasterChip(false);
    } else {
      try {
        const dismissed =
          sessionStorage.getItem(RASTER_HINT_SESSION_KEY) === "true";
        if (!dismissed) {
          setShowRasterChip(true);
        }
      } catch {
        // ignore
      }
    }
  }, [isVector]);

  // Manage highlight marker on map
  useEffect(() => {
    if (!map) return;

    if (!pickedPlace) {
      if (highlightMarkerRef.current) {
        highlightMarkerRef.current.remove();
        highlightMarkerRef.current = null;
      }
      return;
    }

    const updateMarker = (ml: typeof import("maplibre-gl")) => {
      if (!highlightMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "safr-picked-marker";
        el.setAttribute("aria-hidden", "true");

        const pulse = document.createElement("div");
        pulse.className = "safr-picked-marker-pulse";

        const dot = document.createElement("div");
        dot.className = "safr-picked-marker-dot";

        el.appendChild(pulse);
        el.appendChild(dot);

        highlightMarkerRef.current = new ml.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([pickedPlace.lng, pickedPlace.lat])
          .addTo(map);
      } else {
        highlightMarkerRef.current.setLngLat([
          pickedPlace.lng,
          pickedPlace.lat,
        ]);
      }
    };

    if (maplibre) {
      updateMarker(maplibre);
    } else {
      void import("maplibre-gl").then((mod) => {
        updateMarker(mod);
      });
    }
  }, [map, pickedPlace, maplibre]);

  // Clean up marker on unmount
  useEffect(() => {
    return () => {
      if (highlightMarkerRef.current) {
        highlightMarkerRef.current.remove();
        highlightMarkerRef.current = null;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // Global map click and hover handler
  useEffect(() => {
    if (!map) return;

    const handleClick = (e: {
      point: { x: number; y: number };
      originalEvent: MouseEvent;
    }) => {
      // 1. If raster style, picking is inactive
      if (!isVector) return;

      // 2. First check if saved places or clusters were hit
      const savedLayers = [
        "safr-saved-clusters",
        "safr-saved-cluster-count",
        "safr-saved-points",
      ].filter((id) => !!map.getLayer(id));

      if (savedLayers.length > 0) {
        const savedHits = map.queryRenderedFeatures([e.point.x, e.point.y], {
          layers: savedLayers,
        });
        if (savedHits.length > 0) {
          // Let the existing popup/cluster handlers deal with it
          return;
        }
      }

      // 3. Ignore taps that land on route lines
      const routeLayers = (map.getStyle()?.layers || [])
        .map((l) => l.id)
        .filter((id) => id.startsWith("safr-route-"));

      if (routeLayers.length > 0) {
        const routeHits = map.queryRenderedFeatures([e.point.x, e.point.y], {
          layers: routeLayers,
        });
        if (routeHits.length > 0) {
          return;
        }
      }

      // 4. Query candidate symbol layers
      let activeSymbolLayers = CANDIDATE_SYMBOL_LAYERS.filter(
        (id) => !!map.getLayer(id),
      );
      if (activeSymbolLayers.length === 0) {
        activeSymbolLayers = (map.getStyle()?.layers || [])
          .filter(
            (l) =>
              l.type === "symbol" &&
              !l.id.startsWith("safr-") &&
              !l.id.startsWith("road_one_way"),
          )
          .map((l) => l.id);
      }

      if (activeSymbolLayers.length === 0) {
        clearPickedPlace();
        return;
      }

      const bbox: [[number, number], [number, number]] = [
        [e.point.x - 10, e.point.y - 10],
        [e.point.x + 10, e.point.y + 10],
      ];

      const features = map.queryRenderedFeatures(bbox, {
        layers: activeSymbolLayers,
      });

      if (!features || features.length === 0) {
        clearPickedPlace();
        return;
      }

      type Candidate = {
        place: PickedPlace;
        dist: number;
        rank: number;
      };

      const candidates: Candidate[] = [];
      const seenIds = new Set<string>();

      for (const feat of features) {
        const place = featureToPickedPlace(feat as unknown as RawFeatureLike);
        if (!place || !place.name || seenIds.has(place.id)) continue;
        seenIds.add(place.id);

        const projected = map.project([place.lng, place.lat]);
        const dist = Math.hypot(
          projected.x - e.point.x,
          projected.y - e.point.y,
        );
        const rank =
          typeof feat.properties?.["rank"] === "number"
            ? (feat.properties["rank"] as number)
            : 999;
        candidates.push({ place, dist, rank });
      }

      if (candidates.length === 0) {
        clearPickedPlace();
        return;
      }

      candidates.sort((a, b) => {
        const distDiff = a.dist - b.dist;
        if (Math.abs(distDiff) > 1.5) {
          return distDiff;
        }
        return a.rank - b.rank;
      });

      const bestCandidate = candidates[0];
      if (!bestCandidate) {
        clearPickedPlace();
        return;
      }
      const best = bestCandidate.place;
      setPickedPlace(best);
      onPlacePickRef.current?.(best);

      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      map.flyTo({
        center: [best.lng, best.lat],
        padding: isMobile
          ? { bottom: 320, top: 0, left: 0, right: 0 }
          : { left: 380, top: 0, bottom: 0, right: 0 },
        speed: 0.8,
        curve: 1.2,
        essential: true,
      });
    };

    const handleMouseMove = (e: { point: { x: number; y: number } }) => {
      if (!isVector) {
        map.getCanvas().style.cursor = "";
        return;
      }

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (!map) return;

        let activeSymbolLayers = CANDIDATE_SYMBOL_LAYERS.filter(
          (id) => !!map.getLayer(id),
        );
        if (activeSymbolLayers.length === 0) {
          activeSymbolLayers = (map.getStyle()?.layers || [])
            .filter(
              (l) =>
                l.type === "symbol" &&
                !l.id.startsWith("safr-") &&
                !l.id.startsWith("road_one_way"),
            )
            .map((l) => l.id);
        }

        const bbox: [[number, number], [number, number]] = [
          [e.point.x - 4, e.point.y - 4],
          [e.point.x + 4, e.point.y + 4],
        ];

        const symbolFeatures =
          activeSymbolLayers.length > 0
            ? map.queryRenderedFeatures(bbox, {
                layers: activeSymbolLayers,
              })
            : [];

        const hasPickable = symbolFeatures.some((f) => {
          const p = featureToPickedPlace(f as unknown as RawFeatureLike);
          return p && p.name.length > 0;
        });

        if (hasPickable) {
          map.getCanvas().style.cursor = "pointer";
        } else {
          const savedLayers = [
            "safr-saved-clusters",
            "safr-saved-points",
          ].filter((id) => !!map.getLayer(id));
          const savedHits =
            savedLayers.length > 0
              ? map.queryRenderedFeatures([e.point.x, e.point.y], {
                  layers: savedLayers,
                })
              : [];
          map.getCanvas().style.cursor = savedHits.length > 0 ? "pointer" : "";
        }
      });
    };

    const handleMouseLeave = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      map.getCanvas().style.cursor = "";
    };

    map.on("click", handleClick);
    map.on("mousemove", handleMouseMove);
    map.on("mouseout", handleMouseLeave);

    return () => {
      map.off("click", handleClick);
      map.off("mousemove", handleMouseMove);
      map.off("mouseout", handleMouseLeave);
      map.getCanvas().style.cursor = "";
    };
  }, [map, isVector, clearPickedPlace]);

  // Esc key dismisses
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pickedPlace) {
        clearPickedPlace();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pickedPlace, clearPickedPlace]);

  return {
    pickedPlace,
    setPickedPlace,
    clearPickedPlace,
    showRasterChip,
    dismissRasterChip,
  };
}
