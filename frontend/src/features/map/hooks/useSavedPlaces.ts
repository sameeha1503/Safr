import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  Map as MapLibreMap,
  MapLayerMouseEvent,
  GeoJSONSource,
} from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Hit } from "../lib/types";
import { useLatest } from "./useLatest";
import { resolvedCentre } from "@/lib/resolved-centre";

export interface UseSavedPlacesOptions {
  map: MapLibreMap | null;
  maplibre: typeof import("maplibre-gl") | null;
  ready: boolean;
  onSetDestination?: (hit: Hit) => void;
  onAddStop?: (hit: Hit) => void;
}

export function useSavedPlaces({
  map,
  maplibre,
  ready,
  onSetDestination,
  onAddStop,
}: UseSavedPlacesOptions) {
  const [showSavedPlaces, setShowSavedPlaces] = useState(true);
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);

  const onSetDestinationLatest = useLatest(onSetDestination);
  const onAddStopLatest = useLatest(onAddStop);

  // Saved places from Supabase
  const {
    data: savedPlaces = [],
    isError: savedPlacesError,
    isPending: savedPlacesPending,
    refetch: refetchSavedPlaces,
  } = useQuery({
    queryKey: ["saved-places"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_places")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Saved routes from Supabase
  const {
    data: savedRoutesList = [],
    refetch: refetchSavedRoutes,
    isError: savedRoutesError,
    isPending: savedRoutesPending,
  } = useQuery({
    queryKey: ["saved-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_routes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error)
        throw new Error(
          "Saved routes could not be loaded. Check database setup and retry.",
        );
      return data || [];
    },
  });

  const syncSavedPlacesLayer = useCallback(() => {
    if (!map || !map.isStyleLoaded()) return;

    try {
      if (map.getLayer("safr-saved-clusters"))
        map.removeLayer("safr-saved-clusters");
      if (map.getLayer("safr-saved-cluster-count"))
        map.removeLayer("safr-saved-cluster-count");
      if (map.getLayer("safr-saved-points"))
        map.removeLayer("safr-saved-points");
      if (map.getSource("safr-saved-places-src"))
        map.removeSource("safr-saved-places-src");

      if (showSavedPlaces && savedPlaces.length > 0) {
        const validPlaces = savedPlaces.filter((p) =>
          resolvedCentre(p.lat, p.lng),
        );
        const savedGeojson: FeatureCollection = {
          type: "FeatureCollection",
          features: validPlaces.map((p) => ({
            type: "Feature",
            properties: {
              id: p.id,
              name: p.place_name,
              category: p.category,
              notes: p.notes,
              status: p.status,
              lat: p.lat,
              lng: p.lng,
            },
            geometry: {
              type: "Point",
              coordinates: [p.lng!, p.lat!],
            },
          })),
        };

        map.addSource("safr-saved-places-src", {
          type: "geojson",
          data: savedGeojson,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 40,
        });

        map.addLayer({
          id: "safr-saved-clusters",
          type: "circle",
          source: "safr-saved-places-src",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#14b8a6",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              16,
              5,
              22,
              15,
              28,
            ],
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.addLayer({
          id: "safr-saved-cluster-count",
          type: "symbol",
          source: "safr-saved-places-src",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 12,
          },
          paint: {
            "text-color": "#ffffff",
          },
        });

        map.addLayer({
          id: "safr-saved-points",
          type: "circle",
          source: "safr-saved-places-src",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#0d9488",
            "circle-radius": 7,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }
    } catch (e) {
      console.error("Failed to render saved places layer:", e);
    }
  }, [map, showSavedPlaces, savedPlaces]);

  // Synchronize saved places layer when data or toggle changes
  useEffect(() => {
    syncSavedPlacesLayer();
  }, [syncSavedPlacesLayer]);

  // Attach click handlers to the map for saved points and clusters
  useEffect(() => {
    if (!ready || !map || !maplibre) return;

    const onPointsClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice() as [
        number,
        number,
      ];
      const { id, name, category, lat, lng } = feature.properties;

      const popupDiv = document.createElement("div");
      popupDiv.className = "p-2 min-w-[180px]";

      const titleEl = document.createElement("div");
      titleEl.className = "font-bold text-sm text-foreground mb-1";
      titleEl.textContent = name;

      const catEl = document.createElement("div");
      catEl.className =
        "text-[11px] text-muted-foreground uppercase font-semibold mb-2";
      catEl.textContent = category || "Saved Place";

      const btnDest = document.createElement("button");
      btnDest.className =
        "block w-full text-left text-xs font-semibold py-1 px-2 mb-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors";
      btnDest.textContent = "📍 Set as destination";
      btnDest.addEventListener("click", () => {
        const hit: Hit = {
          id: id || "saved",
          name,
          address: category || "Goa",
          lat: Number(lat),
          lng: Number(lng),
        };
        onSetDestinationLatest.current?.(hit);
      });

      const btnStop = document.createElement("button");
      btnStop.className =
        "block w-full text-left text-xs font-semibold py-1 px-2 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors";
      btnStop.textContent = "➕ Add as stop";
      btnStop.addEventListener("click", () => {
        const hit: Hit = {
          id: id || `stop-${Date.now()}`,
          name,
          address: category || "Goa",
          lat: Number(lat),
          lng: Number(lng),
        };
        onAddStopLatest.current?.(hit);
      });

      popupDiv.append(titleEl, catEl, btnDest, btnStop);

      new maplibre.Popup({ offset: 12 })
        .setLngLat(coordinates)
        .setDOMContent(popupDiv)
        .addTo(map);
    };

    const onClustersClick = (e: MapLayerMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["safr-saved-clusters"],
      });
      const clusterId = features[0]?.properties?.["cluster_id"];
      const source = map.getSource<GeoJSONSource>("safr-saved-places-src");
      const geometry = features[0]?.geometry;
      if (
        source &&
        typeof clusterId === "number" &&
        geometry?.type === "Point"
      ) {
        void source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            map.easeTo({
              center: geometry.coordinates as [number, number],
              zoom,
            });
          })
          .catch(() => {
            /* source may have been removed */
          });
      }
    };

    map.on("click", "safr-saved-points", onPointsClick);
    map.on("click", "safr-saved-clusters", onClustersClick);

    return () => {
      try {
        map.off("click", "safr-saved-points", onPointsClick);
        map.off("click", "safr-saved-clusters", onClustersClick);
      } catch {
        /* map may be destroyed */
      }
    };
  }, [ready, map, maplibre, onSetDestinationLatest, onAddStopLatest]);

  const deleteSavedRoute = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("saved_routes")
        .delete()
        .eq("id", id);
      if (error) {
        toast.error("The route could not be removed. Please retry.");
        return;
      }
      refetchSavedRoutes();
      toast.success("Saved route removed");
    },
    [refetchSavedRoutes],
  );

  return {
    savedPlaces,
    savedPlacesError,
    savedPlacesPending,
    refetchSavedPlaces,
    savedRoutesList,
    savedRoutesError,
    savedRoutesPending,
    refetchSavedRoutes,
    deleteSavedRoute,
    showSavedPlaces,
    setShowSavedPlaces,
    showSavedPicker,
    setShowSavedPicker,
    showSavedRoutes,
    setShowSavedRoutes,
    syncSavedPlacesLayer,
  };
}

const savedPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string().optional(),
});
export function parseSavedRoute(
  sr: Database["public"]["Tables"]["saved_routes"]["Row"],
) {
  const destination = savedPointSchema.safeParse(sr.destination);
  const start = savedPointSchema.safeParse(sr.origin);
  const dest: Hit | null = destination.success
    ? {
        id: "saved",
        name: destination.data.name || "Saved destination",
        address: destination.data.name || "Goa",
        lat: destination.data.lat,
        lng: destination.data.lng,
      }
    : null;
  const origin = start.success
    ? { ...start.data, name: start.data.name || "Saved Start" }
    : undefined;
  const waypoints: Hit[] = (
    Array.isArray(sr.waypoints) ? sr.waypoints : []
  ).flatMap((value, index) => {
    const point = savedPointSchema.safeParse(value);
    return point.success
      ? [
          {
            id: `swp-${index}`,
            name: point.data.name || `Stop ${index + 1}`,
            address: "Goa, India",
            lat: point.data.lat,
            lng: point.data.lng,
          },
        ]
      : [];
  });
  return {
    dest,
    origin,
    waypoints,
    mode: z
      .enum(["car", "motor_scooter", "bicycle", "walking"])
      .catch("car")
      .parse(sr.mode),
  };
}
