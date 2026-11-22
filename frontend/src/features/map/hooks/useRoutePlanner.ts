import { reorderStops } from "@/lib/reorder-stops";
import { z } from "zod";
import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Map as MapLibreMap } from "maplibre-gl";
import { GOA_BOUNDS } from "@/lib/map-config";
import { supabase } from "@/integrations/supabase/client";
import type { RouteStep, ScoredRoute, Waypoint } from "@/lib/maps.server";
import type { Hit, TravelMode } from "../lib/types";

export type ComparisonCard = {
  title: string;
  index: number;
  detail: string;
  alsoSafest?: boolean;
};

export interface UseRoutePlannerOptions {
  map: MapLibreMap | null;
  maplibre: typeof import("maplibre-gl") | null;
  origin: { lat: number; lng: number; name?: string };
  originLabel: string;
  destination: Hit | null;
  setDestination: (dest: Hit | null) => void;
  travelMode: TravelMode;
  isNightTime: boolean;
  initialStops?: string | undefined;
  routeFn: (args: {
    data: {
      origin: { lat: number; lng: number; name?: string };
      destination: { lat: number; lng: number; name?: string };
      waypoints: Waypoint[];
      mode: TravelMode;
      isNight: boolean;
    };
  }) => Promise<ScoredRoute[]>;
  searchPlacesFn: (args: { data: { query: string } }) => Promise<Hit[]>;
  refetchSavedRoutes?: () => void;
  updateStepMarker?: (step: RouteStep, idx: number) => void;
  onClearHits?: () => void;
  onOpenSheet?: () => void;
  onRerouted?: (origin: { lat: number; lng: number; name?: string }) => void;
}

export function useRoutePlanner({
  map,
  maplibre,
  origin,
  originLabel,
  destination,
  setDestination,
  travelMode,
  isNightTime,
  initialStops,
  routeFn,
  searchPlacesFn,
  refetchSavedRoutes,
  updateStepMarker,
  onClearHits,
  onOpenSheet,
  onRerouted,
}: UseRoutePlannerOptions) {
  const [routes, setRoutes] = useState<ScoredRoute[]>([]);
  const [selected, setSelected] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const latestRequest = useRef(0);

  // Multi-stop waypoints (max 5)
  const [waypoints, setWaypoints] = useState<Hit[]>([]);
  const [showAddStop, setShowAddStop] = useState(false);
  const [stopQuery, setStopQuery] = useState("");
  const [stopHits, setStopHits] = useState<Hit[]>([]);

  // Parse initial stops from URL params
  useEffect(() => {
    if (initialStops) {
      try {
        const parsedStops = JSON.parse(initialStops);
        if (Array.isArray(parsedStops)) {
          const validated = parsedStops
            .flatMap((value: unknown) => {
              const result = z
                .object({
                  lat: z.number().min(-90).max(90),
                  lng: z.number().min(-180).max(180),
                  name: z.string().optional(),
                })
                .safeParse(value);
              return result.success ? [result.data] : [];
            })
            .slice(0, 5)
            .map((point, index) => ({
              id: `param-stop-${index}`,
              name: point.name || `Stop ${index + 1}`,
              address: "Goa, India",
              lat: point.lat,
              lng: point.lng,
            }));
          setWaypoints(validated);
        }
      } catch {
        // ignore
      }
    }
  }, [initialStops]);

  const stopSearchMutation = useMutation({
    mutationFn: async (q: string) =>
      (await searchPlacesFn({ data: { query: q } })) as Hit[],
    onSuccess: (data) => {
      setStopHits(data);
      if (data.length === 0) toast.info("No matching stops found.");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Stop search failed"),
  });

  const routeMutation = useMutation({
    mutationFn: async (params: {
      origin: { lat: number; lng: number; name?: string };
      destination: Hit;
      waypoints: Hit[];
      mode: TravelMode;
      requestId: number;
      isNight: boolean;
      preserveRoute?: boolean;
    }) => {
      const wpPayload: Waypoint[] = params.waypoints.map((w) => ({
        lat: w.lat,
        lng: w.lng,
        name: w.name,
      }));
      return (await routeFn({
        data: {
          origin: params.origin,
          destination: {
            lat: params.destination.lat,
            lng: params.destination.lng,
            name: params.destination.name,
          },
          waypoints: wpPayload,
          mode: params.mode,
          isNight: params.isNight,
        },
      })) as ScoredRoute[];
    },
    onSuccess: (data, variables) => {
      if (variables.requestId !== latestRequest.current) return;
      if (variables.preserveRoute && data.length === 0) {
        toast.error(
          "No new route found. Previous route retained; check directions before continuing.",
        );
        return;
      }
      if (variables.preserveRoute) {
        setWaypoints(variables.waypoints);
        onRerouted?.(variables.origin);
      }
      setRoutes(data);
      setSelected(0);
      setDestination(variables.destination);
      onClearHits?.();
      setActiveStepIndex(null);
      onOpenSheet?.();
      if (data.length === 0) {
        toast.info("No route found for this configuration.");
      } else {
        toast.success(`Routes calculated for ${variables.destination.name}`);
      }
    },
    onError: (e, variables) => {
      if (variables.requestId !== latestRequest.current) return;
      toast.error(
        e instanceof Error ? e.message : "Could not calculate routes",
      );
    },
  });

  const calculateCurrentRoute = useCallback(
    (
      orig = origin,
      dest = destination,
      wps = waypoints,
      m = travelMode,
      preserveRoute = false,
    ) => {
      if (!dest) return;
      if (!preserveRoute) setRoutes([]);
      setActiveStepIndex(null);
      routeMutation.mutate({
        origin: { ...orig, name: orig.name || originLabel },
        destination: dest,
        waypoints: wps,
        mode: m,
        requestId: ++latestRequest.current,
        isNight: isNightTime,
        preserveRoute,
      });
    },
    [
      origin,
      originLabel,
      destination,
      waypoints,
      travelMode,
      isNightTime,
      routeMutation,
    ],
  );

  const fitMapToRoute = useCallback(() => {
    if (!map || !maplibre) return;

    const bounds = new maplibre.LngLatBounds();
    bounds.extend([origin.lng, origin.lat]);
    waypoints.forEach((w) => bounds.extend([w.lng, w.lat]));
    if (destination) bounds.extend([destination.lng, destination.lat]);

    routes.forEach((r) => {
      if (!r.polyline) return;
      try {
        const pathCoords = JSON.parse(r.polyline) as [number, number][];
        pathCoords.forEach(([lat, lng]) => bounds.extend([lng, lat]));
      } catch {
        // ignore
      }
    });

    const goaSW = (GOA_BOUNDS as [[number, number], [number, number]])[0]!;
    const goaNE = (GOA_BOUNDS as [[number, number], [number, number]])[1]!;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (
      sw.lng < goaSW[0] ||
      sw.lat < goaSW[1] ||
      ne.lng > goaNE[0] ||
      ne.lat > goaNE[1]
    ) {
      map.setMaxBounds(null);
    } else {
      map.setMaxBounds(GOA_BOUNDS);
    }

    map.fitBounds(bounds, {
      padding: {
        top: 48,
        left: 48,
        right: 48,
        bottom:
          window.innerWidth < 1024
            ? Math.min(160, map.getContainer().clientHeight / 3)
            : 48,
      },
    });
  }, [map, maplibre, origin, waypoints, destination, routes]);

  const handleStepClick = useCallback(
    (step: RouteStep, idx: number) => {
      setActiveStepIndex(idx);
      updateStepMarker?.(step, idx);
    },
    [updateStepMarker],
  );

  const handleShareRoute = useCallback(async () => {
    if (!destination) {
      toast.error("Set a destination first to share this trip.");
      return;
    }
    const params = new URLSearchParams();
    params.set("dest", destination.name);
    params.set("lat", String(destination.lat));
    params.set("lng", String(destination.lng));
    params.set("origin", originLabel);
    params.set("originLat", String(origin.lat));
    params.set("originLng", String(origin.lng));
    if (waypoints.length > 0) {
      params.set(
        "stops",
        JSON.stringify(
          waypoints.map((w) => ({ lat: w.lat, lng: w.lng, name: w.name })),
        ),
      );
    }
    const url = `${window.location.origin}/map?${params.toString()}`;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Shareable route link copied to clipboard!");
      } catch {
        toast.info(`Could not copy automatically. Share link: ${url}`);
      }
    } else {
      toast.info(`Share link: ${url}`);
    }
  }, [destination, originLabel, origin, waypoints]);

  const handleSaveRoute = useCallback(async () => {
    if (!destination) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to save routes.");
        return;
      }

      const routeName = `${originLabel.split(" ")[0]} to ${destination.name}${waypoints.length > 0 ? ` (${waypoints.length} stops)` : ""}`;
      const { error } = await supabase.from("saved_routes").insert({
        user_id: user.id,
        name: routeName,
        mode: travelMode,
        origin: { lat: origin.lat, lng: origin.lng, name: originLabel },
        destination: {
          lat: destination.lat,
          lng: destination.lng,
          name: destination.name,
        },
        waypoints: waypoints.map((w) => ({
          lat: w.lat,
          lng: w.lng,
          name: w.name,
        })),
      });
      if (error) throw error;
      toast.success(`Route "${routeName}" saved to My Routes!`);
      refetchSavedRoutes?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save route");
    }
  }, [
    destination,
    originLabel,
    travelMode,
    origin,
    waypoints,
    refetchSavedRoutes,
  ]);

  const currentRoute = routes[selected];
  const fastestIdx = routes.findIndex((r) => r.isFastest);
  const shortestIdx = routes.findIndex((r) => r.isShortest);
  const safestIdx = routes.findIndex((r) => r.isSafest);

  const comparisonCards: ComparisonCard[] = [];
  if (routes.length > 0) {
    if (fastestIdx !== -1 && fastestIdx === shortestIdx) {
      const isSafestAlso = safestIdx !== -1 && safestIdx === fastestIdx;
      comparisonCards.push({
        title: "Fastest & shortest",
        index: fastestIdx,
        detail: "This route is both the quickest and shortest option.",
        alsoSafest: isSafestAlso,
      });
      if (!isSafestAlso && safestIdx !== -1) {
        comparisonCards.push({
          title: "Road-condition preference",
          index: safestIdx,
          detail: "Based on mapped road conditions; not a guarantee",
        });
      }
    } else {
      const isFastestSafest = safestIdx !== -1 && safestIdx === fastestIdx;
      const isShortestSafest = safestIdx !== -1 && safestIdx === shortestIdx;

      if (fastestIdx !== -1) {
        comparisonCards.push({
          title: "Fastest route",
          index: fastestIdx,
          detail: "Lowest estimated travel time",
          alsoSafest: isFastestSafest,
        });
      }
      if (shortestIdx !== -1) {
        comparisonCards.push({
          title: "Shortest route",
          index: shortestIdx,
          detail: `Least road distance among ${routes.length} options`,
          alsoSafest: isShortestSafest,
        });
      }
      if (!isFastestSafest && !isShortestSafest && safestIdx !== -1) {
        comparisonCards.push({
          title: "Road-condition preference",
          index: safestIdx,
          detail: "Based on mapped road conditions; not a guarantee",
        });
      }
    }
  }

  const reorderStop = useCallback(
    (from: number, to: number) => {
      const updated = reorderStops(waypoints, from, to);
      setWaypoints(updated);
      calculateCurrentRoute(origin, destination, updated, travelMode);
    },
    [waypoints, calculateCurrentRoute, origin, destination, travelMode],
  );
  const moveStopUp = (index: number) => reorderStop(index, index - 1);
  const moveStopDown = (index: number) => reorderStop(index, index + 1);

  const removeStop = useCallback(
    (idx: number) => {
      const updated = waypoints.filter((_, i) => i !== idx);
      setWaypoints(updated);
      calculateCurrentRoute(origin, destination, updated, travelMode);
    },
    [calculateCurrentRoute, destination, origin, travelMode, waypoints],
  );

  const addStop = useCallback(
    (h: Hit) => {
      if (waypoints.length >= 5) {
        toast.error("Maximum 5 stops reached.");
        return;
      }
      const updated = [...waypoints, h];
      setWaypoints(updated);
      setShowAddStop(false);
      setStopHits([]);
      setStopQuery("");
      toast.success(`Stop added: ${h.name}`);
      calculateCurrentRoute(origin, destination, updated, travelMode);
    },
    [calculateCurrentRoute, destination, origin, travelMode, waypoints],
  );

  return {
    reorderStop,
    moveStopUp,
    moveStopDown,
    removeStop,
    addStop,
    routes,
    setRoutes,
    selected,
    setSelected,
    activeStepIndex,
    setActiveStepIndex,
    waypoints,
    setWaypoints,
    showAddStop,
    setShowAddStop,
    stopQuery,
    setStopQuery,
    stopHits,
    setStopHits,
    showDirections,
    setShowDirections,
    stopSearchMutation,
    routeMutation,
    calculateCurrentRoute,
    fitMapToRoute,
    handleStepClick,
    handleShareRoute,
    handleSaveRoute,
    currentRoute,
    comparisonCards,
  };
}
