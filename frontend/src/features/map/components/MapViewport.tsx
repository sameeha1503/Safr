import type { ReactNode, RefObject } from "react";
import { Sparkles, X } from "lucide-react";
import { RecenterButton } from "./RecenterButton";
import { PlaceCard } from "./PlaceCard";
import { MapStatusOverlays } from "./MapStatusOverlays";
import type { PickedPlace } from "../lib/place-picking";
import type { UserLocationResult } from "../hooks/useUserLocation";
import type { SavedPlaceRecord } from "../hooks/useToggleSavedPlace";

export interface MapViewportProps {
  mapEl: RefObject<HTMLDivElement | null>;
  userLocation: UserLocationResult;
  showRasterChip: boolean;
  onSwitchToStreets: () => void;
  onDismissRasterChip: () => void;
  pickedPlace: PickedPlace | null;
  savedPlaces: SavedPlaceRecord[];
  isStopLimitReached: boolean;
  onClosePlace: () => void;
  onDirectionsPlace: (place: PickedPlace) => void;
  onAddStopPlace: (place: PickedPlace) => void;
  isLoadingMap: boolean;
  mapLoadError: boolean;
  onRetryMap: () => void;
  navigation?: ReactNode;
}

export function MapViewport({
  mapEl,
  userLocation,
  showRasterChip,
  onSwitchToStreets,
  onDismissRasterChip,
  pickedPlace,
  savedPlaces,
  isStopLimitReached,
  onClosePlace,
  onDirectionsPlace,
  onAddStopPlace,
  isLoadingMap,
  mapLoadError,
  onRetryMap,
  navigation,
}: MapViewportProps) {
  return (
    <div className="relative w-full h-full min-h-0 rounded-3xl border border-border/60 bg-secondary/40 shadow-inner overflow-hidden">
      <div ref={mapEl} className="h-full w-full" />
      {navigation}

      <div className="absolute top-[146px] right-2.5 z-10 pointer-events-auto">
        <RecenterButton
          followMode={userLocation.followMode}
          pannedAway={userLocation.pannedAway}
          hasPosition={userLocation.position !== null}
          onCycle={userLocation.cycleFollow}
        />
      </div>

      {showRasterChip && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur-sm">
          <button
            type="button"
            onClick={onSwitchToStreets}
            className="text-xs font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Switch to Streets to tap places on the map</span>
          </button>
          <button
            type="button"
            onClick={onDismissRasterChip}
            aria-label="Dismiss hint"
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {pickedPlace && (
        <PlaceCard
          place={pickedPlace}
          userLocation={
            userLocation.position
              ? {
                  lat: userLocation.position.lat,
                  lng: userLocation.position.lng,
                }
              : null
          }
          savedPlaces={savedPlaces}
          isStopLimitReached={isStopLimitReached}
          onClose={onClosePlace}
          onDirections={onDirectionsPlace}
          onAddAsStop={onAddStopPlace}
        />
      )}

      <MapStatusOverlays
        isLoadingMap={isLoadingMap}
        mapLoadError={mapLoadError}
        onRetry={onRetryMap}
      />
    </div>
  );
}
