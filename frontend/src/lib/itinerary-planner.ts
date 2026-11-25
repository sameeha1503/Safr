import type { NearbyPlace } from "./geo";

export function formatPlanTime(minutes: number) {
  const day = Math.floor(minutes / 1440),
    time = minutes % 1440;
  return `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}${day ? ` (+${day} day)` : ""}`;
}

export interface PlanStop {
  id?: string;
  time: string;
  title: string;
  type: "food" | "sight" | "activity" | "beach" | "rest" | "travel";
  duration: string;
  durationMin: number;
  arrivalMinute: number;
  departureMinute: number;
  description: string;
  travel_note: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
  transitMin?: number;
  sourceUrl?: string;
  crowdLevel?: "low" | "moderate" | "high";
  slot?: "en-route" | "main" | "meal" | "sunset" | "arrive";
  why?: string;
  openStatus?: "open" | "unknown";
  detourMin?: number;
  source?: "catalogue" | "overpass" | "curated";
  kind?: string;
}

export function scheduleItinerary(input: {
  candidates: NearbyPlace[];
  durations: (number | null)[][];
  distances: (number | null)[][];
  reachable: boolean[];
  hours: number;
  startTime: string;
  pace: "relaxed" | "balanced" | "packed";
  returnToStart: boolean;
  preferredIds: string[];
}) {
  const [h, m] = input.startTime.split(":").map(Number);
  const start = h! * 60 + m!,
    deadline = start + input.hours * 60;
  let clock = start,
    previous = 0;
  const stops: PlanStop[] = [];
  const remaining = input.candidates.map((place, i) => ({
    place,
    index: i + 1,
  }));
  const buffer =
    input.pace === "relaxed" ? 15 : input.pace === "balanced" ? 10 : 5;
  const visit =
    input.pace === "relaxed" ? 75 : input.pace === "balanced" ? 50 : 30;
  while (remaining.length && stops.length < 12) {
    const options = remaining
      .flatMap(({ place, index }) => {
        if (!input.preferredIds.includes(place.id)) return [];
        const seconds = input.durations[previous]?.[index],
          meters = input.distances[previous]?.[index];
        const back = input.returnToStart ? input.durations[index]?.[0] : 0;
        if (
          !input.reachable[0] ||
          !input.reachable[index] ||
          seconds == null ||
          meters == null ||
          back == null
        )
          return [];
        const drive = Math.ceil(seconds / 60),
          transit = drive + buffer;
        const preferredDuration =
          place.category === "restaurant" ? Math.max(40, visit) : visit;
        const available =
          deadline -
          clock -
          transit -
          (input.returnToStart ? Math.ceil(back / 60) + buffer : 0);
        // A short budget can still support one worthwhile visit; never invent tiny visits to fill it.
        const duration =
          stops.length === 0
            ? Math.min(preferredDuration, available)
            : preferredDuration;
        if (duration < (place.category === "restaurant" ? 30 : 20)) return [];
        if (
          clock +
            transit +
            duration +
            (input.returnToStart ? Math.ceil(back / 60) + buffer : 0) >
          deadline
        )
          return [];
        const rank = input.preferredIds.indexOf(place.id);
        // Anti-clustering penalty: avoid back-to-back restaurants or same venue types
        const lastStop = stops[stops.length - 1];
        let diversityPenalty = 0;
        if (lastStop) {
          if (lastStop.type === "food" && place.category === "restaurant") {
            diversityPenalty += 80;
          } else if (
            (lastStop.type === "beach" && place.kind === "beach") ||
            lastStop.title === place.name
          ) {
            diversityPenalty += 25;
          }
        }
        return [
          {
            place,
            index,
            drive,
            transit,
            duration,
            meters,
            score: transit + (rank < 0 ? 60 : rank * 12) + diversityPenalty,
          },
        ];
      })
      .sort((a, b) => a.score - b.score);
    const next = options[0];
    if (!next) break;
    const arrival = clock + next.transit,
      end = arrival + next.duration;
    const stopType =
      next.place.category === "restaurant"
        ? ("food" as const)
        : next.place.kind === "beach"
          ? ("beach" as const)
          : [
                "water_sports",
                "water_park",
                "sports_centre",
                "nightclub",
              ].includes(next.place.kind)
            ? ("activity" as const)
            : ("sight" as const);
    stops.push({
      time: `${formatPlanTime(arrival)} – ${formatPlanTime(end)}`,
      title: next.place.name,
      type: stopType,
      duration: `${next.duration} mins`,
      durationMin: next.duration,
      arrivalMinute: arrival,
      departureMinute: end,
      description:
        next.place.highlight ||
        `${next.place.kind.replaceAll("_", " ")} listed on OpenStreetMap.${next.place.cuisine ? ` Cuisine: ${next.place.cuisine.replaceAll(";", ", ")}.` : ""}`,
      travel_note: `${next.drive} min estimated drive + ${buffer} min arrival buffer from ${stops.length ? "previous stop" : "your starting point"}. ${next.place.openingHours ? `Listed hours: ${next.place.openingHours}. Confirm before visiting.` : "Opening hours unavailable; confirm before visiting."}`,
      lat: next.place.lat,
      lng: next.place.lng,
      distanceKm: Math.round(next.meters / 100) / 10,
      transitMin: next.transit,
      sourceUrl: next.place.sourceUrl,
    });
    clock = end;
    previous = next.index;
    remaining.splice(
      remaining.findIndex((p) => p.index === next.index),
      1,
    );
  }
  const returnMinutes =
    stops.length && input.returnToStart
      ? Math.ceil(input.durations[previous]![0]! / 60) + buffer
      : 0;
  return {
    stops,
    totalMinutes: clock - start + returnMinutes,
    unusedMinutes: deadline - clock - returnMinutes,
    returnMinutes,
    endTime: formatPlanTime(clock + returnMinutes),
    budgetMinutes: input.hours * 60,
  };
}
