import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Umbrella,
  Church,
  Landmark,
  Castle,
  Coffee,
  Wine,
  Utensils,
  Hotel,
  Eye,
  Waves,
  Trees,
  Building2,
  Building,
  Home,
  MapPin,
  Plane,
  Bus,
  Hospital,
  Shield,
  Fuel,
  ShoppingBag,
  Sparkles,
  Phone,
  Globe,
  Clock,
  Navigation,
  Plus,
  Bookmark,
  CalendarPlus,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentArea } from "@/lib/goa.functions";
import { getPlaceDetails } from "@/lib/maps.functions";
import { distanceKm, type Coordinate } from "@/lib/geo";
import { parseOpeningHours } from "../lib/opening-hours";
import {
  useToggleSavedPlace,
  type SavedPlaceRecord,
} from "../hooks/useToggleSavedPlace";
import type { PickedPlace } from "../lib/place-picking";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Umbrella,
  Church,
  Landmark,
  Castle,
  Coffee,
  Wine,
  Utensils,
  Hotel,
  Eye,
  Waves,
  Trees,
  Building2,
  Building,
  Home,
  MapPin,
  Plane,
  Bus,
  Hospital,
  Shield,
  Fuel,
  ShoppingBag,
  Sparkles,
};

export interface PlaceCardProps {
  place: PickedPlace;
  userLocation?: Coordinate | null;
  savedPlaces?: SavedPlaceRecord[];
  isStopLimitReached?: boolean;
  onClose: () => void;
  onDirections: (place: PickedPlace) => void;
  onAddAsStop: (place: PickedPlace) => void;
  onAddToItinerary?: (place: PickedPlace) => void;
}

export function PlaceCard({
  place,
  userLocation,
  savedPlaces = [],
  isStopLimitReached = false,
  onClose,
  onDirections,
  onAddAsStop,
  onAddToItinerary,
}: PlaceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const getCurrentAreaFn = useServerFn(getCurrentArea);
  const getPlaceDetailsFn = useServerFn(getPlaceDetails);
  const toggleSavedMutation = useToggleSavedPlace();

  // Focus dialog on open for accessibility
  useEffect(() => {
    cardRef.current?.focus();
  }, [place.id]);

  // Lazy area line
  const { data: areaName, isLoading: isLoadingArea } = useQuery({
    queryKey: ["place-area", place.lat.toFixed(4), place.lng.toFixed(4)],
    queryFn: async () => {
      try {
        const res = await getCurrentAreaFn({
          data: { lat: place.lat, lng: place.lng },
        });
        return res?.name ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 60 * 60 * 1000,
  });

  // Lazy place details (Overpass around:50)
  const { data: fetchedDetails, isLoading: isLoadingDetails } = useQuery({
    enabled: !place.catalogueDetails,
    queryKey: ["place-details", place.id],
    queryFn: async () => {
      try {
        return await getPlaceDetailsFn({
          data: { lat: place.lat, lng: place.lng, name: place.name },
        });
      } catch {
        return null;
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  const details = place.catalogueDetails || fetchedDetails;
  const parsedHours = details?.openingHours
    ? parseOpeningHours(details.openingHours)
    : null;

  // Live distance from user location
  const distance = userLocation
    ? distanceKm(userLocation, { lat: place.lat, lng: place.lng })
    : null;

  // Check if place is saved
  const isSaved = savedPlaces.some(
    (p) => p.place_name.toLowerCase() === place.name.toLowerCase(),
  );

  const IconComponent = ICON_MAP[place.iconKey] || MapPin;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={place.name}
      tabIndex={-1}
      className="fixed bottom-0 left-0 right-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 shadow-2xl transition-all duration-300 outline-none md:absolute md:bottom-auto md:left-4 md:right-auto md:top-20 md:w-[360px] md:rounded-2xl md:border md:border-border"
    >
      {/* Mobile drag handle bar */}
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30 md:hidden" />

      {/* Header: Icon, Name, Kind, Close button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <IconComponent className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-foreground">
              {place.name}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-primary">
                {place.kindLabel}
              </span>
              {distance != null && (
                <>
                  <span>•</span>
                  <span>
                    {distance < 1
                      ? `${Math.round(distance * 1000)} m away`
                      : `${distance.toFixed(1)} km away`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close place card"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Area line (lazy) */}
      <div className="mt-2.5">
        {isLoadingArea ? (
          <Skeleton className="h-3.5 w-36" />
        ) : areaName ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{areaName}, Goa</span>
          </div>
        ) : null}
      </div>

      {/* Place details: opening hours, cuisine, contact */}
      <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
        {isLoadingDetails && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Checking details...</span>
          </div>
        )}

        {/* Opening Hours */}
        {parsedHours && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {parsedHours.isOpen === true && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {parsedHours.statusBadge || "Open now"}
                  {parsedHours.statusDetail && ` · ${parsedHours.statusDetail}`}
                </span>
              )}
              {parsedHours.isOpen === false && (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  {parsedHours.statusBadge || "Closed"}
                  {parsedHours.statusDetail && ` · ${parsedHours.statusDetail}`}
                </span>
              )}
              {parsedHours.isOpen === undefined && (
                <span className="text-muted-foreground">{parsedHours.raw}</span>
              )}
            </div>
            {parsedHours.isOpen !== undefined && (
              <div className="pl-5 text-[11px] text-muted-foreground">
                {parsedHours.raw}
              </div>
            )}
          </div>
        )}

        {/* Cuisine */}
        {details?.cuisine && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Utensils className="h-3.5 w-3.5 shrink-0" />
            <span className="capitalize">{details.cuisine}</span>
          </div>
        )}

        {/* Phone */}
        {details?.phone && (
          <div className="flex items-center gap-2 text-xs">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <a
              href={`tel:${details.phone}`}
              className="text-primary hover:underline"
            >
              {details.phone}
            </a>
          </div>
        )}

        {/* Website */}
        {details?.website && (
          <div className="flex items-center gap-2 text-xs truncate">
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <a
              href={details.website}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-primary hover:underline"
            >
              {details.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}
      </div>

      {/* Action Row */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        {/* Directions button */}
        <Button
          size="sm"
          onClick={() => onDirections(place)}
          className="flex-1 min-w-[100px] gap-1.5 font-semibold"
        >
          <Navigation className="h-4 w-4" />
          Directions
        </Button>

        {/* Add as stop button */}
        <Button
          size="sm"
          variant="secondary"
          disabled={isStopLimitReached}
          title={
            isStopLimitReached ? "Maximum of 5 stops allowed" : "Add as stop"
          }
          onClick={() => onAddAsStop(place)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Stop
        </Button>

        {/* Save toggle button */}
        <Button
          size="sm"
          variant={isSaved ? "default" : "outline"}
          onClick={() => toggleSavedMutation.mutate(place)}
          disabled={toggleSavedMutation.isPending}
          className={`gap-1.5 ${
            isSaved
              ? "bg-teal-600 hover:bg-teal-700 text-white"
              : "text-foreground"
          }`}
        >
          {isSaved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4" />
              Save
            </>
          )}
        </Button>

        {/* Optional Add to itinerary button */}
        {onAddToItinerary && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddToItinerary(place)}
            className="w-full mt-1 gap-1.5"
          >
            <CalendarPlus className="h-4 w-4" />
            Add to Itinerary
          </Button>
        )}
      </div>
    </div>
  );
}
