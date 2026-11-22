import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { Map as MapLibreMap } from "maplibre-gl";
import { usePlacePicker } from "./usePlacePicker";
import type { PickedPlace } from "../lib/place-picking";
import type { Hit, TravelMode } from "../lib/types";
import { saveRecentSearch, getRecentSearches } from "../lib/recent-searches";

export interface UsePlaceActionsOptions {
  ready: boolean;
  map: MapLibreMap | null;
  maplibre: typeof import("maplibre-gl") | null;
  isVector: boolean;
  waypoints: Hit[];
  origin: { lat: number; lng: number; name?: string };
  travelMode: TravelMode;
  setDestination: (h: Hit | null) => void;
  setQuery: (q: string) => void;
  setWaypoints: React.Dispatch<React.SetStateAction<Hit[]>>;
  setSheetExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setRecentDestinations: (hits: Hit[]) => void;
  calculateCurrentRoute: (
    orig?: { lat: number; lng: number; name?: string },
    dest?: Hit | null,
    wps?: Hit[],
    m?: TravelMode,
  ) => void;
}

export function usePlaceActions({
  ready,
  map,
  maplibre,
  isVector,
  waypoints,
  origin,
  travelMode,
  setDestination,
  setQuery,
  setWaypoints,
  setSheetExpanded,
  setRecentDestinations,
  calculateCurrentRoute,
}: UsePlaceActionsOptions) {
  const routeSheetWasExpandedRef = useRef(false);

  const handlePlacePick = useCallback(
    (_place: PickedPlace) => {
      setSheetExpanded((prev) => {
        if (prev) {
          routeSheetWasExpandedRef.current = true;
          return false;
        }
        return prev;
      });
    },
    [setSheetExpanded],
  );

  const handlePlaceDismiss = useCallback(() => {
    if (routeSheetWasExpandedRef.current) {
      setSheetExpanded(true);
      routeSheetWasExpandedRef.current = false;
    }
  }, [setSheetExpanded]);

  const {
    pickedPlace,
    setPickedPlace,
    clearPickedPlace,
    showRasterChip,
    dismissRasterChip,
  } = usePlacePicker({
    map: ready ? map : null,
    maplibre: ready ? maplibre : null,
    isVector,
    onPlacePick: handlePlacePick,
    onDismiss: handlePlaceDismiss,
  });

  const handlePlaceClose = () => {
    clearPickedPlace();
    if (routeSheetWasExpandedRef.current) {
      setSheetExpanded(true);
      routeSheetWasExpandedRef.current = false;
    }
  };

  const handlePlaceDirections = (place: PickedPlace) => {
    const hit: Hit = {
      id: place.id,
      name: place.name,
      address: place.kindLabel,
      lat: place.lat,
      lng: place.lng,
    };
    setDestination(hit);
    setQuery(hit.name);
    saveRecentSearch(hit);
    setRecentDestinations(getRecentSearches());
    calculateCurrentRoute(origin, hit, waypoints, travelMode);
    clearPickedPlace();
    routeSheetWasExpandedRef.current = false;
  };

  const handlePlaceAddStop = (place: PickedPlace) => {
    if (waypoints.length >= 5) {
      toast.error("Maximum of 5 stops allowed.");
      return;
    }
    const stopHit: Hit = {
      id: place.id,
      name: place.name,
      address: place.kindLabel,
      lat: place.lat,
      lng: place.lng,
    };
    const updated = [...waypoints, stopHit];
    setWaypoints(updated);
    toast.success(`Added ${place.name} as stop`);
    calculateCurrentRoute(origin, undefined, updated, travelMode);
  };

  return {
    selectPlace: (place: PickedPlace) => {
      setPickedPlace(place);
      handlePlacePick(place);
    },
    pickedPlace,
    showRasterChip,
    dismissRasterChip,
    handlePlaceClose,
    handlePlaceDirections,
    handlePlaceAddStop,
  };
}
