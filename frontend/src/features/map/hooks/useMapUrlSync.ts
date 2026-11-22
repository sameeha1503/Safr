import { useEffect, useRef } from "react";
import type { Hit, TravelMode } from "../lib/types";
import { saveRecentSearch, getRecentSearches } from "../lib/recent-searches";

export interface UseMapUrlSyncOptions {
  ready: boolean;
  locationReady: boolean;
  searchParams: {
    dest?: string;
    lat?: string;
    lng?: string;
    stops?: string;
  };
  origin: { lat: number; lng: number; name?: string };
  waypoints: Hit[];
  travelMode: TravelMode;
  calculateCurrentRoute: (
    orig?: { lat: number; lng: number; name?: string },
    dest?: Hit | null,
    wps?: Hit[],
    m?: TravelMode,
  ) => void;
  onSearchDest: (q: string) => void;
  setDestination: (h: Hit | null) => void;
  setRecentDestinations: (hits: Hit[]) => void;
}

export function useMapUrlSync({
  ready,
  locationReady,
  searchParams,
  origin,
  waypoints,
  travelMode,
  calculateCurrentRoute,
  onSearchDest,
  setDestination,
  setRecentDestinations,
}: UseMapUrlSyncOptions) {
  const requestedTarget = useRef("");

  useEffect(() => {
    if (!ready || !locationReady || !searchParams.dest) return;
    const key = JSON.stringify([
      searchParams.dest,
      searchParams.lat,
      searchParams.lng,
      waypoints.map(({ lat, lng, name }) => [lat, lng, name]),
    ]);
    if (requestedTarget.current === key) return;
    requestedTarget.current = key;

    if (
      searchParams.dest &&
      searchParams.lat &&
      searchParams.lng &&
      ready &&
      locationReady
    ) {
      const parsedLat = parseFloat(searchParams.lat);
      const parsedLng = parseFloat(searchParams.lng);
      if (
        Number.isFinite(parsedLat) &&
        Number.isFinite(parsedLng) &&
        Math.abs(parsedLat) <= 90 &&
        Math.abs(parsedLng) <= 180
      ) {
        const destHit: Hit = {
          id: "prefill",
          name: searchParams.dest,
          address: "Goa, India",
          lat: parsedLat,
          lng: parsedLng,
        };
        setDestination(destHit);
        saveRecentSearch(destHit);
        setRecentDestinations(getRecentSearches());
        calculateCurrentRoute(origin, destHit, waypoints, travelMode);
      }
    } else if (
      searchParams.dest &&
      !searchParams.lat &&
      ready &&
      locationReady
    ) {
      onSearchDest(searchParams.dest);
    }
  }, [
    searchParams.dest,
    searchParams.lat,
    searchParams.lng,
    searchParams.stops,
    ready,
    locationReady,
    origin,
    waypoints,
    travelMode,
    calculateCurrentRoute,
    onSearchDest,
    setDestination,
    setRecentDestinations,
  ]);
}
