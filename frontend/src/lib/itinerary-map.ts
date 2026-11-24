import { itinerarySchema, type Itinerary } from "./goa-schemas";

export type ItineraryMapSearch = {
  dest: string;
  lat: string;
  lng: string;
  origin: string;
  originLat: string;
  originLng: string;
  stops?: string;
};

export type ItineraryMapHandoff = {
  search: ItineraryMapSearch;
  includedStopCount: number;
  mappedStopCount: number;
};

export function parseSavedItinerary(value: unknown): Itinerary | null {
  const parsed = itinerarySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function itineraryMapHandoff(
  itinerary: Itinerary,
  placeName: string,
): ItineraryMapHandoff | null {
  const mappedStops = itinerary.stops.flatMap((stop) =>
    stop.lat == null || stop.lng == null
      ? []
      : [{ name: stop.title, lat: stop.lat, lng: stop.lng }],
  );
  if (mappedStops.length < 2 && !itinerary.origin && !itinerary.journey)
    return null;
  if (mappedStops.length === 0) return null;

  // Journey mode: use journey.start as origin and destination as end, with stops as waypoints
  if (
    itinerary.mode === "journey" &&
    itinerary.journey?.start &&
    itinerary.journey?.destination
  ) {
    const origin = {
      name: itinerary.journey.start.name || "Starting point",
      lat: itinerary.journey.start.lat,
      lng: itinerary.journey.start.lng,
    };
    const returnsToStart = (itinerary.returnMinutes ?? 0) > 0;
    const destination = returnsToStart
      ? origin
      : {
          name: itinerary.journey.destination.name || placeName,
          lat: itinerary.journey.destination.lat,
          lng: itinerary.journey.destination.lng,
        };
    const waypoints = mappedStops.slice(0, 5);

    return {
      search: {
        dest: destination.name,
        lat: String(destination.lat),
        lng: String(destination.lng),
        origin: origin.name,
        originLat: String(origin.lat),
        originLng: String(origin.lng),
        ...(waypoints.length > 0
          ? {
              stops: JSON.stringify(
                waypoints.map(({ name, lat, lng }) => ({ name, lat, lng })),
              ),
            }
          : {}),
      },
      includedStopCount: waypoints.length,
      mappedStopCount: mappedStops.length,
    };
  }

  // Anchor mode (keep existing behaviour)
  const returnsToStart =
    itinerary.origin != null && (itinerary.returnMinutes ?? 0) > 0;
  const origin = itinerary.origin
    ? { ...itinerary.origin, name: `${placeName} starting point` }
    : mappedStops[0]!;

  const available = itinerary.origin ? mappedStops : mappedStops.slice(1);
  const included = available.slice(0, returnsToStart ? 5 : 6);
  if (included.length === 0) return null;

  const destination = returnsToStart ? origin : included.at(-1)!;
  const waypoints = returnsToStart ? included : included.slice(0, -1);

  return {
    search: {
      dest: destination.name,
      lat: String(destination.lat),
      lng: String(destination.lng),
      origin: origin.name,
      originLat: String(origin.lat),
      originLng: String(origin.lng),
      ...(waypoints.length > 0
        ? {
            stops: JSON.stringify(
              waypoints.map(({ name, lat, lng }) => ({ name, lat, lng })),
            ),
          }
        : {}),
    },
    includedStopCount: included.length + (itinerary.origin ? 0 : 1),
    mappedStopCount: mappedStops.length,
  };
}
