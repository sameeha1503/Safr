import { createHash } from "node:crypto";
import { fetchJson } from "./places.server";
import { getCached, setCached } from "./place-cache.server";
import {
  assessRoadConditions,
  roadBounds,
  routePreferences,
  type RoadWay,
  type SafetyEvidence,
} from "./route-comparison";
import { z } from "zod";
import { fetchValhallaRoutes, type InternalRoute } from "./valhalla.server";
import {
  fetchKnownHazardZones,
  hazardZonesOnRoute,
  type HazardZone,
} from "./hazard-zones.server";

export type PlaceHit = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export async function searchGoaPlaces(query: string): Promise<PlaceHit[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query + " Goa")}&lat=15.35&lon=73.95&limit=6`;
  try {
    const json = z
      .object({
        features: z.array(
          z.object({
            properties: z.object({
              osm_id: z.number(),
              osm_type: z.string().optional(),
              name: z.string().optional(),
              street: z.string().optional(),
              city: z.string().optional(),
              state: z.string().optional(),
            }),
            geometry: z.object({
              coordinates: z.tuple([z.number(), z.number()]),
            }),
          }),
        ),
      })
      .parse(await fetchJson(url, {}, 6000));

    return json.features
      .filter((f) => f.properties.state === "Goa")
      .map((f) => ({
        id: `${f.properties.osm_type || "place"}/${f.properties.osm_id}`,
        name: f.properties.name ?? "Unnamed place",
        address:
          [f.properties.street, f.properties.city, f.properties.state]
            .filter(Boolean)
            .join(", ") || "Goa, India",
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
  } catch {
    return [];
  }
}

export type OSRMStep = {
  name: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string | undefined;
    location?: [number, number] | undefined; // [lng, lat]
    exit?: number | undefined;
  };
};

export type OSRMRoute = InternalRoute;

export type Waypoint = {
  lat: number;
  lng: number;
  name?: string | undefined;
};

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  maneuverModifier?: string | undefined;
  name: string;
  location?: [number, number] | undefined; // [lat, lng]
  legIndex?: number;
};

export type RouteLeg = {
  legIndex: number;
  fromName: string;
  toName: string;
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
};

export type ScoredRoute = {
  label: string;
  kind: "fastest" | "safer" | "alt";
  distanceKm: number;
  durationMin: number;
  distanceMeters: number;
  durationSeconds: number;
  safety: SafetyEvidence;
  hazardZones: HazardZone[];
  hazardDataAvailable?: boolean;
  isFastest: boolean;
  isShortest: boolean;
  isSafest: boolean;
  reasons: string[];
  polyline: string;
  summary: string;
  steps: RouteStep[];
  legs?: RouteLeg[];
  googleMapsUrl: string;
  mode?: string;
  waypoints?: Waypoint[];
};

function formatManeuverInstruction(step: OSRMStep): string {
  const name =
    step.name && step.name.trim().length > 0 ? step.name : "the road";
  const modifier = step.maneuver.modifier
    ? step.maneuver.modifier.replace("-", " ")
    : "";
  const type = step.maneuver.type;

  switch (type) {
    case "depart":
      return `Head ${modifier || "forward"} on ${name}`;
    case "arrive":
      return `Arrive at your destination`;
    case "turn":
      return `Turn ${modifier || "ahead"} onto ${name}`;
    case "roundabout":
    case "rotary":
      return step.maneuver.exit
        ? `At the roundabout, take exit ${step.maneuver.exit} onto ${name}`
        : `Enter the roundabout and take exit onto ${name}`;
    case "fork":
      return `Take the ${modifier || "next"} fork onto ${name}`;
    case "merge":
      return `Merge ${modifier || ""} onto ${name}`;
    case "on ramp":
      return `Take the ramp onto ${name}`;
    case "off ramp":
      return `Take the exit onto ${name}`;
    case "end of road":
      return `Turn ${modifier || ""} at the end of the road onto ${name}`;
    case "continue":
    case "new name":
    default:
      return modifier && modifier !== "straight"
        ? `Make a ${modifier} onto ${name}`
        : `Continue along ${name}`;
  }
}

function scoreRoute(
  route: InternalRoute,
  origin: { lat: number; lng: number; name?: string | undefined },
  destination: { lat: number; lng: number; name?: string | undefined },
  safety: SafetyEvidence,
  waypoints: Waypoint[] = [],
  mode: string = "car",
  hazardZones: HazardZone[] = [],
): ScoredRoute {
  const durationMin = Math.ceil(route.duration / 60);
  const distanceKm = Math.round(route.distance / 100) / 10;

  const namedStops = [
    origin.name || "Starting Point",
    ...waypoints.map((w, idx) => w.name || `Stop ${idx + 1}`),
    destination.name || "Destination",
  ];

  const routeLegs: RouteLeg[] = (route.legs || []).map((l, idx) => {
    const rawSteps = l.steps || [];
    const precomputedSteps = l.routeSteps || [];
    const legSteps: RouteStep[] =
      precomputedSteps.length > 0
        ? precomputedSteps.map((s) => ({ ...s, legIndex: idx }))
        : rawSteps.map((s) => ({
          instruction: formatManeuverInstruction(s),
          distanceMeters: Math.round(s.distance ?? 0),
          durationSeconds: Math.round(s.duration ?? 0),
          maneuverType: s.maneuver.type ?? "continue",
          maneuverModifier: s.maneuver.modifier,
          name: s.name || "Road",
          location: s.maneuver.location
            ? [s.maneuver.location[1], s.maneuver.location[0]]
            : undefined,
          legIndex: idx,
        }));

    const legDist = legSteps.reduce((acc, s) => acc + s.distanceMeters, 0);
    const legDur = legSteps.reduce((acc, s) => acc + s.durationSeconds, 0);

    return {
      legIndex: idx,
      fromName: namedStops[idx] || `Stop ${idx}`,
      toName: namedStops[idx + 1] || `Stop ${idx + 1}`,
      distanceMeters: legDist > 0 ? legDist : route.distance,
      durationSeconds: legDur > 0 ? legDur : route.duration,
      steps: legSteps,
    };
  });

  const steps: RouteStep[] = routeLegs.flatMap((l) => l.steps);

  const gmapsMode =
    mode === "walking"
      ? "walking"
      : mode === "bicycle"
        ? "bicycling"
        : mode === "motor_scooter"
          ? "two-wheeler"
          : "driving";
  const waypointsParam =
    waypoints.length > 0
      ? `&waypoints=${waypoints.map((w) => `${w.lat},${w.lng}`).join("|")}`
      : "";
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointsParam}&travelmode=${gmapsMode}`;

  const reasons = [...safety.reasons];
  if (mode === "walking" || mode === "bicycle") {
    reasons.push(
      "Road safety index is estimated for vehicular travel; walking and cycling conditions may vary based on pedestrian infrastructure.",
    );
  }
  if (waypoints.length > 0) {
    reasons.push(
      `Multi-stop trip routed through ${waypoints.length} intermediate stop${waypoints.length > 1 ? "s" : ""}; distance and time summed across all legs.`,
    );
  }
  if (hazardZones.length > 0) {
    reasons.push(
      `Passes within the mapped radius of ${hazardZones.length} known accident-prone location${hazardZones.length > 1 ? "s" : ""}: ${hazardZones.map((z) => z.label).join(", ")}.`,
    );
  }
  reasons.push(
    "Distance and time are compared before rounding. Times exclude live traffic.",
    "Google Maps may choose a different path; the displayed path and turn list are the route assessed here.",
  );

  return {
    label: "",
    kind: "fastest",
    distanceKm,
    durationMin,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    safety,
    hazardZones,
    isFastest: false,
    isShortest: false,
    isSafest: false,
    reasons,
    summary:
      route.legs?.[0]?.summary ||
      steps.find((s) => s.name)?.name ||
      "Local Road Route",
    polyline: JSON.stringify(
      route.geometry.coordinates.map((c) => [c[1], c[0]]),
    ),
    steps,
    legs: routeLegs,
    googleMapsUrl,
    mode,
    waypoints,
  };
}

async function fetchOSRMRoutes(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints: Waypoint[] = [],
): Promise<InternalRoute[]> {
  const coordsList = [origin, ...waypoints, destination];
  const coordsStr = coordsList.map((p) => `${p.lng},${p.lat}`).join(";");
  const baseUrl = (
    process.env["OSRM_BASE_URL"] || "https://router.project-osrm.org"
  ).replace(/\/$/, "");
  const url = `${baseUrl}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&alternatives=3&steps=true&annotations=nodes,distance`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!response.ok) {
    const body = await response.text();
    console.error(`OSRM routes failed [${response.status}]: ${body}`);
    throw new Error(
      "Could not work out routes for that trip. Please try again.",
    );
  }

  const json = (await response.json()) as {
    code?: string;
    routes?: InternalRoute[];
    waypoints?: { distance: number }[];
  };
  if (
    json.waypoints?.some(
      (point) => !Number.isFinite(point.distance) || point.distance > 1000,
    )
  ) {
    throw new Error(
      "A location is more than 1 km from a routable road. Choose its road entrance or a nearby accessible starting point.",
    );
  }
  return (json.routes ?? []).filter(
    (route) =>
      Number.isFinite(route.distance) &&
      route.distance >= 0 &&
      Number.isFinite(route.duration) &&
      route.duration >= 0 &&
      route.geometry?.coordinates?.length >= 2 &&
      route.geometry.coordinates.every(
        ([lng, lat]) =>
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          Math.abs(lat) <= 90 &&
          Math.abs(lng) <= 180,
      ),
  );
}

const roadWaySchema = z.object({
  id: z.number().optional(),
  nodes: z.array(z.number()),
  tags: z.record(z.string()),
});

const overpassWaysResponseSchema = z.object({
  remark: z.string().optional(),
  elements: z.array(roadWaySchema).optional().default([]),
});

function roadWaysCacheKey(bounds: string): string {
  const parts = bounds
    .split(",")
    .map((p) => {
      const n = Number(p.trim());
      return Number.isFinite(n) ? n.toFixed(3) : p.trim();
    })
    .join(",");
  return `road-ways:${parts}`;
}

const defaultEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

function getOverpassEndpoints(): string[] {
  const envUrl = process.env["OVERPASS_URL"]?.trim();
  return [
    ...(envUrl ? [envUrl] : []),
    ...defaultEndpoints,
  ].filter((url, idx, arr) => arr.indexOf(url) === idx);
}

export async function fetchRoadWays(bounds: string): Promise<RoadWay[]> {
  const cacheKey = roadWaysCacheKey(bounds);
  try {
    const cached = await getCached(cacheKey);
    if (Array.isArray(cached) && cached.length > 0) {
      const parsed = z.array(roadWaySchema).safeParse(cached);
      if (parsed.success && parsed.data.length > 0) {
        return parsed.data;
      }
    }
  } catch {
    /* Cache read failure shouldn't block network lookup. */
  }

  const endpoints = getOverpassEndpoints();

  const query = `[out:json][timeout:10];way(${bounds})[highway][highway!~"^(footway|path|steps|cycleway|pedestrian|track|bridleway|corridor|elevator|proposed|construction|service)$"];out body qt;`;

  const totalDeadline = Date.now() + 20000;
  const reasons: string[] = [];

  for (const endpoint of endpoints) {
    const now = Date.now();
    const remainingTotal = totalDeadline - now;
    if (remainingTotal <= 0) {
      reasons.push("Total timeout of 20s exceeded");
      break;
    }

    let hostname = endpoint;
    try {
      hostname = new URL(endpoint).hostname;
    } catch {
      // fallback to endpoint string
    }

    const timeoutMs = Math.min(8000, remainingTotal);

    try {
      const url = new URL(endpoint);
      url.searchParams.set("data", query);

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Safr/1.0 (Goa travel planner; https://github.com/Prajj11/Ideas)",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const statusReason = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
        console.warn(`[routing] ${hostname}: ${statusReason}`);
        reasons.push(`${hostname}: ${statusReason}`);
        continue;
      }

      const json = (await response.json()) as unknown;
      const data = overpassWaysResponseSchema.parse(json);

      if (data.remark) {
        const remarkReason = `remark: ${data.remark}`;
        console.warn(`[routing] ${hostname}: ${remarkReason}`);
        reasons.push(`${hostname}: ${remarkReason}`);
        continue;
      }

      const ways = data.elements;
      console.log(
        `[routing] road ways loaded: ${ways.length} ways from ${hostname}`,
      );

      if (ways.length === 0) {
        const emptyReason = `${hostname}: returned 0 ways`;
        console.warn(`[routing] ${emptyReason}`);
        reasons.push(emptyReason);
        continue;
      }

      try {
        await setCached(cacheKey, ways, 6 * 60 * 60);
      } catch {
        /* Cache write failure must not fail the request. */
      }

      return ways;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[routing] ${hostname}: ${errorMsg}`);
      reasons.push(`${hostname}: ${errorMsg}`);
    }
  }

  console.error(
    "[routing] Overpass road-tags lookup failed on all endpoints",
    reasons,
  );
  return [];
}

const roadWayByIdSchema = z.object({
  id: z.number().optional(),
  nodes: z.array(z.number()).optional().default([]),
  tags: z.record(z.string()).default({}),
});

const overpassWaysByIdsResponseSchema = z.object({
  remark: z.string().optional(),
  elements: z.array(roadWayByIdSchema).optional().default([]),
});

export async function fetchRoadWaysByIds(ids: number[]): Promise<RoadWay[]> {
  if (ids.length === 0) return [];

  const sorted = [...ids].sort((a, b) => a - b);
  const hash = createHash("sha1").update(sorted.join(",")).digest("hex");
  const cacheKey = `road-ways-ids:${hash}`;

  try {
    const cached = await getCached(cacheKey);
    if (Array.isArray(cached) && cached.length > 0) {
      const parsed = z.array(roadWaySchema).safeParse(cached);
      if (parsed.success && parsed.data.length > 0) {
        return parsed.data;
      }
    }
  } catch {
    /* Cache read failure shouldn't block network lookup. */
  }

  const endpoints = getOverpassEndpoints();
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 400) {
    chunks.push(ids.slice(i, i + 400));
  }

  const overallDeadline = Date.now() + 22000;
  const reasons: string[] = [];
  const ways: RoadWay[] = [];
  let successfulHostname = "";

  for (const chunk of chunks) {
    const query = `[out:json][timeout:15];way(id:${chunk.join(",")});out tags;`;
    let chunkWays: RoadWay[] | null = null;

    for (const endpoint of endpoints) {
      const remainingTotal = overallDeadline - Date.now();
      if (remainingTotal <= 0) {
        reasons.push("Total timeout of 22s exceeded");
        break;
      }

      let hostname = endpoint;
      try {
        hostname = new URL(endpoint).hostname;
      } catch {
        // fallback to endpoint string
      }

      const timeoutMs = Math.min(10000, remainingTotal);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent":
              "Safr/1.0 (Goa travel planner; https://github.com/Prajj11/Ideas)",
          },
          body: new URLSearchParams({ data: query }).toString(),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const reason = `${hostname}: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
          console.warn(`[routing] ${reason}`);
          reasons.push(reason);
          continue;
        }

        const json = (await response.json()) as unknown;
        const data = overpassWaysByIdsResponseSchema.parse(json);

        if (data.remark) {
          const reason = `${hostname}: remark: ${data.remark}`;
          console.warn(`[routing] ${reason}`);
          reasons.push(reason);
          continue;
        }

        chunkWays = data.elements;
        successfulHostname = hostname;
        break;
      } catch (err: unknown) {
        const msg = `${hostname}: ${err instanceof Error ? err.message : String(err)}`;
        console.warn(`[routing] ${msg}`);
        reasons.push(msg);
      }
    }

    if (chunkWays && chunkWays.length > 0) {
      ways.push(...chunkWays);
    }
  }

  if (ways.length > 0) {
    const hostname = successfulHostname || "overpass";
    console.log(
      `[routing] road tags by id: ${ways.length}/${ids.length} ways from ${hostname}`,
    );

    try {
      await setCached(cacheKey, ways, 6 * 60 * 60);
    } catch {
      /* Cache write failure must not fail the request. */
    }

    return ways;
  }

  console.error(
    "[routing] Overpass road-tags lookup by ID failed on all endpoints",
    reasons,
  );
  return [];
}

export async function computeSafeRoutes(
  origin: { lat: number; lng: number; name?: string | undefined },
  destination: { lat: number; lng: number; name?: string | undefined },
  isNight: boolean = false,
  waypoints: Waypoint[] = [],
  mode: string = "car",
): Promise<ScoredRoute[]> {
  const provider = (
    process.env["ROUTING_PROVIDER"] || "valhalla"
  ).toLowerCase();
  let raw: InternalRoute[] = [];

  if (provider === "valhalla" || mode !== "car") {
    try {
      raw = await fetchValhallaRoutes(origin, destination, waypoints, mode);
      if (raw.length === 0) {
        if (mode !== "car")
          throw new Error(
            `${mode} routing is temporarily unavailable. Try again later or choose driving explicitly.`,
          );
        console.warn(
          "[routing] Valhalla returned 0 routes, falling back to OSRM",
        );
        raw = await fetchOSRMRoutes(origin, destination, waypoints);
      }
    } catch (err: unknown) {
      if (mode !== "car")
        throw new Error(
          `${mode} routing is temporarily unavailable. Try again later or choose driving explicitly.`,
        );
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("more than 1 km from a routable road")) {
        throw err;
      }
      console.error(
        "[routing] Valhalla routing failed, falling back to OSRM:",
        err,
      );
      raw = await fetchOSRMRoutes(origin, destination, waypoints);
    }
  } else {
    raw = await fetchOSRMRoutes(origin, destination, waypoints);
  }

  if (raw.length === 0) return [];

  const unique = raw.filter(
    (route, i) =>
      raw.findIndex(
        (r) =>
          JSON.stringify(r.geometry.coordinates) ===
          JSON.stringify(route.geometry.coordinates),
      ) === i,
  );
  const hazardZonesAll = await fetchKnownHazardZones();
  let ways: RoadWay[] = [];
  try {
    const ids = Array.from(
      new Set(
        unique
          .flatMap((r) => r.legs ?? [])
          .flatMap((leg) => leg.annotation?.wayIds ?? [])
          .filter(
            (id): id is number =>
              typeof id === "number" && Number.isFinite(id) && id > 0,
          ),
      ),
    );

    if (ids.length > 0) {
      ways = await fetchRoadWaysByIds(ids);
    } else {
      const points = unique.flatMap((r) =>
        r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      );
      const bounds = roadBounds(points);
      // Bound public-service work for very long trips; unknown coverage is explicit.
      if (
        Math.max(...points.map((p) => p.lat)) -
          Math.min(...points.map((p) => p.lat)) <
          1 &&
        Math.max(...points.map((p) => p.lng)) -
          Math.min(...points.map((p) => p.lng)) <
          1
      ) {
        ways = await fetchRoadWays(bounds);
      }
    }
  } catch (err) {
    console.error(
      "[routing] Overpass road-tags lookup failed:",
      err instanceof Error ? err.message : err,
    );
    /* Never substitute fabricated safety scores for missing map data. */
  }
  const candidates = unique.map((r) =>
    scoreRoute(
      r,
      origin,
      destination,
      assessRoadConditions(r.legs, ways, isNight),
      waypoints,
      mode,
      hazardZonesOnRoute(
        r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        hazardZonesAll ?? [],
      ),
    ),
  );
  const best = routePreferences(candidates);
  const safestIndex = best.safest;
  return candidates.map((r, i) => ({
    ...r,
    hazardDataAvailable: hazardZonesAll !== null,
    kind: i === best.fastest ? "fastest" : i === safestIndex ? "safer" : "alt",
    label:
      i === best.fastest ? "Fastest available route" : `Alternative ${i + 1}`,
    isFastest: i === best.fastest,
    isShortest: i === best.shortest,
    isSafest: i === safestIndex,
  }));
}
