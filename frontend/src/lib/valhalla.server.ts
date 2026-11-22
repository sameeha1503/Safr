import { distanceKm, type Coordinate } from "./geo";
import type { RouteStep } from "./maps.server";

export type InternalRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] }; // [lng, lat][]
  legs: Array<{
    summary?: string | undefined;
    steps?:
    | Array<{
      name: string;
      distance: number;
      duration: number;
      maneuver: {
        type: string;
        modifier?: string | undefined;
        location?: [number, number] | undefined;
        exit?: number | undefined;
      };
    }>
    | undefined;
    routeSteps?: RouteStep[] | undefined;
    annotation?:
    | {
      nodes?: number[] | undefined;
      wayIds?: number[] | undefined;
      distance: number[];
    }
    | undefined;
  }>;
};

/**
 * Decodes a polyline encoded with 6 decimal places of precision (polyline6)
 * into an array of [lng, lat] coordinates.
 */
export function decodePolyline6(encoded: string): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];
  const factor = 1e6;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push([lng / factor, lat / factor]);
  }
  return coordinates;
}

export function mapValhallaManeuverType(type?: number): string {
  switch (type) {
    case 1:
    case 2:
    case 3:
      return "depart";
    case 4:
    case 5:
    case 6:
      return "arrive";
    case 9:
    case 10:
    case 11:
    case 14:
    case 15:
    case 16:
      return "turn";
    case 12:
    case 13:
      return "uturn";
    case 17:
    case 18:
    case 19:
      return "on ramp";
    case 20:
    case 21:
      return "off ramp";
    case 25:
      return "merge";
    case 26:
    case 27:
      return "roundabout";
    case 28:
    case 29:
      return "ferry";
    case 7:
    case 8:
    case 22:
    case 23:
    case 24:
    default:
      return "continue";
  }
}

export function mapValhallaManeuverModifier(
  type?: number,
): string | undefined {
  switch (type) {
    case 9:
      return "slight-right";
    case 10:
      return "right";
    case 11:
    case 12:
      return "sharp-right";
    case 13:
    case 14:
      return "sharp-left";
    case 15:
      return "left";
    case 16:
      return "slight-left";
    case 2:
    case 5:
    case 18:
    case 20:
    case 23:
    case 37:
      return "right";
    case 3:
    case 6:
    case 19:
    case 21:
    case 24:
    case 38:
      return "left";
    default:
      return undefined;
  }
}

type ValhallaManeuver = {
  type?: number;
  instruction?: string;
  time?: number;
  length?: number;
  street_names?: string[];
  begin_shape_index?: number;
  end_shape_index?: number;
};

type ValhallaLeg = {
  shape: string;
  summary?: { length: number; time: number };
  maneuvers?: ValhallaManeuver[];
};

type ValhallaTrip = {
  summary: { length: number; time: number };
  legs: ValhallaLeg[];
  locations?: Array<{ lat: number; lon: number }>;
};

type ValhallaRouteResponse = {
  trip?: ValhallaTrip;
  alternates?: Array<{ trip: ValhallaTrip }>;
  error_code?: number;
  error?: string;
};

export function areRoutesDuplicate(
  aCoords: [number, number][],
  aDist: number,
  aDur: number,
  bCoords: [number, number][],
  bDist: number,
  bDur: number,
): boolean {
  // Check exact geometry coordinates
  if (JSON.stringify(aCoords) === JSON.stringify(bCoords)) return true;

  // Check if distance and duration both differ by < 1%
  const maxDist = Math.max(aDist, bDist, 1);
  const maxDur = Math.max(aDur, bDur, 1);
  const distDiff = Math.abs(aDist - bDist) / maxDist;
  const durDiff = Math.abs(aDur - bDur) / maxDur;
  if (distDiff < 0.01 && durDiff < 0.01) {
    return true;
  }

  // Check if they share >= 95% of their points
  if (aCoords.length > 0 && bCoords.length > 0) {
    const key = (c: [number, number]) =>
      `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
    const setA = new Set(aCoords.map(key));
    let sharedB = 0;
    for (const c of bCoords) {
      if (setA.has(key(c))) sharedB++;
    }
    const ratioB = sharedB / bCoords.length;

    const setB = new Set(bCoords.map(key));
    let sharedA = 0;
    for (const c of aCoords) {
      if (setB.has(key(c))) sharedA++;
    }
    const ratioA = sharedA / aCoords.length;

    if (ratioA >= 0.95 || ratioB >= 0.95) {
      return true;
    }
  }

  return false;
}

async function fetchValhallaTripBundle(
  baseUrl: string,
  body: Record<string, unknown>,
): Promise<ValhallaTrip[]> {
  const response = await fetch(`${baseUrl}/route`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent":
        "Safr/1.0 (Goa travel planner; https://github.com/Prajj11/Ideas)",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedError: ValhallaRouteResponse | undefined;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {
      // not JSON
    }

    if (
      parsedError?.error_code === 171 ||
      parsedError?.error?.toLowerCase().includes("no suitable edges") ||
      errorBody.toLowerCase().includes("edges near location")
    ) {
      throw new Error(
        "A location is more than 1 km from a routable road. Choose its road entrance or a nearby accessible starting point.",
      );
    }

    throw new Error(
      `Valhalla route request failed [${response.status}]: ${errorBody}`,
    );
  }

  const json = (await response.json()) as ValhallaRouteResponse;
  const rawTrips: ValhallaTrip[] = [
    json.trip,
    ...(json.alternates?.map((a) => a.trip) ?? []),
  ].filter((t): t is ValhallaTrip =>
    Boolean(
      t &&
      t.summary &&
      Number.isFinite(t.summary.length) &&
      t.summary.length >= 0 &&
      Number.isFinite(t.summary.time) &&
      t.summary.time >= 0 &&
      t.legs &&
      t.legs.length > 0 &&
      typeof t.legs[0]?.shape === "string",
    ),
  );
  return rawTrips;
}

const VALHALLA_COSTINGS: Record<string, string> = {
  car: "auto",
  motor_scooter: "motor_scooter",
  bicycle: "bicycle",
  walking: "pedestrian",
};

export async function fetchValhallaRoutes(
  origin: Coordinate,
  destination: Coordinate,
  waypoints: Array<Coordinate & { name?: string | undefined }> = [],
  mode: string = "car",
): Promise<InternalRoute[]> {
  const baseUrl = (
    process.env["VALHALLA_BASE_URL"] || "https://valhalla1.openstreetmap.de"
  ).replace(/\/$/, "");

  const costing = VALHALLA_COSTINGS[mode] || "auto";

  const locations = [
    { lat: origin.lat, lon: origin.lng },
    ...waypoints.map((w) => ({
      lat: w.lat,
      lon: w.lng,
      type: "break" as const,
    })),
    { lat: destination.lat, lon: destination.lng },
  ];
  const directionsOptions = { units: "kilometers", language: "en-US" };

  // 1. Fastest-oriented
  const reqFastest = {
    locations,
    costing,
    alternates: 2,
    directions_options: directionsOptions,
  };

  // 2. Distance-oriented
  const reqShortest = {
    locations,
    costing,
    costing_options: {
      [costing]: {
        shortest: true,
      },
    },
    alternates: 1,
    directions_options: directionsOptions,
  };

  // 3. Different road choice (lower use_highways for secondary/local roads where available)
  const reqLowHighways = {
    locations,
    costing,
    costing_options: {
      [costing]: {
        use_highways: 0.1,
      },
    },
    alternates: 1,
    directions_options: directionsOptions,
  };

  const results = await Promise.allSettled([
    fetchValhallaTripBundle(baseUrl, reqFastest),
    fetchValhallaTripBundle(baseUrl, reqShortest),
    fetchValhallaTripBundle(baseUrl, reqLowHighways),
  ]);

  // If all failed, check if it's the > 1 km error or general failure
  if (results.every((r) => r.status === "rejected")) {
    const reasons = results.map((r) => (r as PromiseRejectedResult).reason);
    const distanceErr = reasons.find(
      (err) =>
        err instanceof Error &&
        err.message.includes("more than 1 km from a routable road"),
    );
    if (distanceErr) throw distanceErr;
    throw reasons[0] || new Error("All Valhalla route requests failed.");
  }

  type UniqueCandidate = {
    trip: ValhallaTrip;
    coords: [number, number][];
    distMeters: number;
    durSeconds: number;
  };

  const uniqueCandidates: UniqueCandidate[] = [];
  const counts = { fastest: 0, shortest: 0, low_highways: 0 };
  const names: Array<keyof typeof counts> = [
    "fastest",
    "shortest",
    "low_highways",
  ];

  results.forEach((res, idx) => {
    if (res.status !== "fulfilled") return;
    const reqName = names[idx]!;
    const trips = res.value;

    for (const trip of trips) {
      if (!trip.legs || trip.legs.length === 0) continue;

      const allCoords: [number, number][] = [];
      let valid = true;

      for (let legIdx = 0; legIdx < trip.legs.length; legIdx++) {
        const leg = trip.legs[legIdx]!;
        const legCoords = decodePolyline6(leg.shape);
        if (legCoords.length < 2) {
          valid = false;
          break;
        }

        const validCoords = legCoords.every(
          ([lng, lat]) =>
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            Math.abs(lat) <= 90 &&
            Math.abs(lng) <= 180,
        );
        if (!validCoords) {
          valid = false;
          break;
        }

        const expectedStart = legIdx === 0 ? origin : waypoints[legIdx - 1]!;
        const expectedEnd =
          legIdx === trip.legs.length - 1 ? destination : waypoints[legIdx]!;
        const startCoord = legCoords[0]!;
        const endCoord = legCoords[legCoords.length - 1]!;
        if (
          distanceKm(expectedStart, {
            lat: startCoord[1],
            lng: startCoord[0],
          }) > 1.0 ||
          distanceKm(expectedEnd, { lat: endCoord[1], lng: endCoord[0] }) > 1.0
        ) {
          throw new Error(
            "A location is more than 1 km from a routable road. Choose its road entrance or a nearby accessible starting point.",
          );
        }

        if (allCoords.length === 0) {
          allCoords.push(...legCoords);
        } else {
          allCoords.push(...legCoords.slice(1));
        }
      }

      if (!valid || allCoords.length < 2) continue;

      const distMeters = Math.round(trip.summary.length * 1000);
      const durSeconds = Math.round(trip.summary.time);

      const isDup = uniqueCandidates.some((c) =>
        areRoutesDuplicate(
          c.coords,
          c.distMeters,
          c.durSeconds,
          allCoords,
          distMeters,
          durSeconds,
        ),
      );

      if (!isDup) {
        uniqueCandidates.push({
          trip,
          coords: allCoords,
          distMeters,
          durSeconds,
        });
        counts[reqName]++;
      }
    }
  });

  console.log(
    `[valhalla] Candidates contributed: fastest: ${counts.fastest}, shortest: ${counts.shortest}, low_highways: ${counts.low_highways} (total unique: ${uniqueCandidates.length})`,
  );

  if (uniqueCandidates.length === 0) return [];

  const internalRoutes: InternalRoute[] = await Promise.all(
    uniqueCandidates.map(async ({ trip, coords, distMeters, durSeconds }) => {
      const processedLegs = await Promise.all(
        trip.legs.map(async (leg, legIdx) => {
          const legCoords = decodePolyline6(leg.shape);
          const routeSteps: RouteStep[] = (leg.maneuvers || []).map((m) => {
            const beginIdx =
              typeof m.begin_shape_index === "number" &&
                m.begin_shape_index >= 0 &&
                m.begin_shape_index < legCoords.length
                ? m.begin_shape_index
                : 0;
            const pt = legCoords[beginIdx];
            const location: [number, number] | undefined = pt
              ? [pt[1], pt[0]]
              : undefined;
            const name = m.street_names?.[0] || "the road";

            return {
              instruction: m.instruction || `Continue along ${name}`,
              distanceMeters: Math.round((m.length ?? 0) * 1000),
              durationSeconds: Math.round(m.time ?? 0),
              maneuverType: mapValhallaManeuverType(m.type),
              maneuverModifier: mapValhallaManeuverModifier(m.type),
              name,
              location,
              legIndex: legIdx,
            };
          });

          let wayIds: number[] = [];
          let edgeDistances: number[] = [];

          try {
            const traceRes = await fetch(`${baseUrl}/trace_attributes`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "User-Agent":
                  "Safr/1.0 (Goa travel planner; https://github.com/Prajj11/Ideas)",
              },
              body: JSON.stringify({
                encoded_polyline: leg.shape,
                costing,
                shape_match: "map_snap",
              }),
              signal: AbortSignal.timeout(15000),
            });

            if (traceRes.ok) {
              const traceData = (await traceRes.json()) as {
                edges?: Array<{ way_id?: number; length?: number }>;
              };
              if (
                Array.isArray(traceData.edges) &&
                traceData.edges.length > 0
              ) {
                wayIds = traceData.edges.map((e) => e.way_id || 0);
                edgeDistances = traceData.edges.map((e) =>
                  Math.round((e.length ?? 0) * 1000),
                );
              }
            } else {
              console.warn(
                `[valhalla] trace_attributes failed with status ${traceRes.status}; safety data will be reported as unknown`,
              );
            }
          } catch (traceErr) {
            console.warn(
              "[valhalla] trace_attributes network or timeout error; safety data will be reported as unknown:",
              traceErr,
            );
          }

          const hasCompleteAnnotation =
            wayIds.length > 0 &&
            edgeDistances.length > 0 &&
            wayIds.length === edgeDistances.length;

          const summary =
            leg.maneuvers?.find((m) => m.street_names?.[0])
              ?.street_names?.[0] ||
            routeSteps.find((s) => s.name && s.name !== "the road")?.name ||
            (trip.legs.length > 1 ? `Leg ${legIdx + 1}` : "Local Road Route");

          return {
            summary,
            routeSteps,
            annotation: hasCompleteAnnotation
              ? { wayIds, distance: edgeDistances }
              : undefined,
          };
        }),
      );

      return {
        distance: distMeters,
        duration: durSeconds,
        geometry: { coordinates: coords },
        legs: processedLegs,
      };
    }),
  );

  return internalRoutes;
}
