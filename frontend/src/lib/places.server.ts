import { getCached, setCached } from "./place-cache.server";
import { z } from "zod";
import {
  distanceKm,
  distanceToRoute,
  type Coordinate,
  type NearbyPlace,
} from "./geo";

export function isSanePlaceName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  // Must contain at least one real letter (rejects pure numbers/symbols)
  if (!/\p{L}/u.test(trimmed)) return false;
  // Reject obvious placeholder/junk values
  if (/^(unnamed|n\/?a|test|tbd|none|null|undefined|unknown)$/i.test(trimmed))
    return false;
  // Reject values that look like a URL, phone number, or email rather than a name
  if (/https?:\/\/|www\.|@|^\+?\d[\d\s-]{6,}$/.test(trimmed)) return false;
  return true;
}

export async function fetchJson(
  url: string,
  init: RequestInit = {},
  timeout = 6000,
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set(
    "User-Agent",
    "Safr/1.0 (Goa travel planner; https://github.com/Prajj11/Ideas)",
  );
  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(Math.min(timeout, 20000)),
  });
  if (!response.ok)
    throw new Error(
      `Map service ${new URL(url).hostname} unavailable (${response.status}). Please retry shortly.`,
    );
  return response.json();
}

const photonSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({
        name: z.string().optional(),
        street: z.string().optional(),
        suburb: z.string().optional(),
        locality: z.string().optional(),
        district: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        countrycode: z.string().optional(),
        osm_id: z.number().optional(),
      }),
    }),
  ),
});

export async function locatePlace(
  place: string,
  state = "Goa",
  timeout = 6000,
) {
  const result = photonSchema.parse(
    await fetchJson(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(`${place}, ${state}, India`)}&limit=8`,
      {},
      timeout,
    ),
  );
  const hit = result.features.find(
    (f) =>
      f.properties.state?.toLowerCase() === state.toLowerCase() &&
      (f.properties.countrycode?.toLowerCase() === "in" ||
        f.properties.country === "India"),
  );
  if (!hit)
    throw new Error(
      `Could not locate ${place} in ${state}. Try a nearby town or landmark.`,
    );
  return {
    lat: hit.geometry.coordinates[1],
    lng: hit.geometry.coordinates[0],
    name: hit.properties.name || place,
    state: hit.properties.state || state,
  };
}

export async function reverseLocation(point: Coordinate) {
  const result = photonSchema.parse(
    await fetchJson(
      `https://photon.komoot.io/reverse?lat=${point.lat}&lon=${point.lng}&limit=1`,
    ),
  );
  const hit = result.features[0]?.properties;
  if (
    !hit?.state ||
    (hit.countrycode?.toLowerCase() !== "in" && hit.country !== "India")
  ) {
    throw new Error(
      "Current-location planning is available in India. Choose a destination and state manually.",
    );
  }
  // Pick specific landmark/street/locality first, falling back to suburb/city/district
  const primary =
    hit.name ||
    hit.street ||
    hit.locality ||
    hit.suburb ||
    hit.city ||
    hit.district;
  const secondary =
    hit.suburb && hit.suburb !== primary
      ? hit.suburb
      : hit.city && hit.city !== primary
        ? hit.city
        : hit.district && hit.district !== primary
          ? hit.district
          : undefined;

  const displayName =
    primary && secondary ? `${primary}, ${secondary}` : primary || hit.state;

  return {
    ...point,
    name: displayName,
    state: hit.state,
  };
}

const overpassSchema = z.object({
  remark: z.string().optional(),
  elements: z.array(
    z.object({
      type: z.enum(["node", "way", "relation"]),
      id: z.number(),
      lat: z.number().optional(),
      lon: z.number().optional(),
      center: z.object({ lat: z.number(), lon: z.number() }).optional(),
      tags: z.record(z.string()).optional(),
    }),
  ),
});

import { CURATED_GOA_PLACES } from "./goa-places-data";
import {
  cataloguePlacesInBox,
  type OverpassElementLike,
} from "./goa-catalogue.server";

/** At most two attempts within nine seconds; configured private instances stay private. */
export async function fetchOverpass(query: string): Promise<unknown> {
  const primary =
    process.env["OVERPASS_URL"] || "https://overpass-api.de/api/interpreter";
  const fallback =
    process.env["OVERPASS_FALLBACK_URL"] ||
    (!process.env["OVERPASS_URL"]
      ? "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
      : "");
  const endpoints = [...new Set([primary, fallback].filter(Boolean))];
  const deadline = Date.now() + 9000;
  for (const [index, endpoint] of endpoints.entries()) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const url = new URL(endpoint);
      url.searchParams.set("data", query);
      const value = overpassSchema.parse(
        await fetchJson(
          url.toString(),
          {},
          index === endpoints.length - 1
            ? remaining
            : Math.min(5000, remaining),
        ),
      );
      if (value.remark && !value.elements.length) continue;
      return value;
    } catch (error) {
      // Category only: never log query text, response bodies or credentials.
      console.warn(
        "Overpass attempt failed:",
        new URL(endpoint).hostname,
        error instanceof Error ? error.name : "Unknown",
      );
      /* Try the configured mirror before the caller's curated fallback. */
    }
  }
  console.error(
    `[places] All Overpass endpoints failed for query (first 100 chars): ${query.slice(0, 100)}`,
  );
  throw new Error("Nearby-place providers are temporarily unavailable.");
}

export async function nearbyPlacesWithMeta(
  center: Coordinate,
  radiusKm = 5,
  path: Coordinate[] = [],
): Promise<{ places: NearbyPlace[]; degraded: boolean }> {
  const key = JSON.stringify([
    center.lat.toFixed(3),
    center.lng.toFixed(3),
    radiusKm,
    path,
  ]);
  const cached = await getCached(`nearby:${key}`);
  if (Array.isArray(cached))
    return { places: cached as NearbyPlace[], degraded: false };

  // Gather curated places within search range
  const searchLimit = Math.max(radiusKm * 1.5, 15);
  const curatedMatches: NearbyPlace[] = CURATED_GOA_PLACES.map((p) => {
    const dist = distanceKm(center, p);
    const fromRoute = path.length ? distanceToRoute(p, path) : undefined;
    return {
      ...p,
      distanceKm: dist,
      routeDistanceKm: fromRoute,
    };
  }).filter((p) =>
    p.routeDistanceKm != null
      ? p.routeDistanceKm <= 2.5
      : p.distanceKm <= searchLimit,
  );

  // A bounding-box lookup is substantially cheaper than Overpass's many-segment
  // around query. Filter the results against the actual road geometry below.
  const latPad = 1.5 / 111.195;
  const lngPad = latPad / Math.max(0.1, Math.cos((center.lat * Math.PI) / 180));
  const minLat =
    (path.length > 1
      ? Math.min(...path.map((p) => p.lat))
      : center.lat - radiusKm / 111.195) - latPad;
  const maxLat =
    (path.length > 1
      ? Math.max(...path.map((p) => p.lat))
      : center.lat + radiusKm / 111.195) + latPad;
  const radLng =
    radiusKm / 111.195 / Math.max(0.1, Math.cos((center.lat * Math.PI) / 180));
  const minLng =
    (path.length > 1
      ? Math.min(...path.map((p) => p.lng))
      : center.lng - radLng) - lngPad;
  const maxLng =
    (path.length > 1
      ? Math.max(...path.map((p) => p.lng))
      : center.lng + radLng) + lngPad;

  // 1. Primary candidate source: local Goa catalogue (in-memory)
  const catalogueElements = cataloguePlacesInBox({
    minLat,
    minLng,
    maxLat,
    maxLng,
  });

  let elements: OverpassElementLike[] = [];
  let degraded = false;
  let elementSource: "catalogue" | "overpass" = "catalogue";

  if (catalogueElements.length >= 15) {
    elements = catalogueElements;
    degraded = false;
    elementSource = "catalogue";
  } else {
    // 2. Secondary fallback: live Overpass only if catalogue has < 15 elements or failed
    const around =
      path.length > 1
        ? `${Math.min(...path.map((p) => p.lat)) - latPad},${Math.min(...path.map((p) => p.lng)) - lngPad},${Math.max(...path.map((p) => p.lat)) + latPad},${Math.max(...path.map((p) => p.lng)) + lngPad}`
        : `around:${radiusKm * 1000},${center.lat},${center.lng}`;
    const placeFilters: [string, string][] = [
      [
        "amenity",
        "restaurant|cafe|fast_food|food_court|bar|pub|nightclub|marketplace|place_of_worship",
      ],
      [
        "tourism",
        "hotel|guest_house|hostel|motel|attraction|museum|viewpoint|gallery|zoo|theme_park",
      ],
      ["historic", "castle|fort|monument|ruins|archaeological_site"],
      ["natural", "beach|waterfall"],
      ["leisure", "water_park|sports_centre|park|nature_reserve"],
    ];
    const query = `[out:json][timeout:9];(${placeFilters
      .map(
        ([key, values]) => `nwr["${key}"~"^(${values})$"]["name"](${around});`,
      )
      .join("")});out center tags 500;`;

    let rawResult: unknown;
    try {
      rawResult = await fetchOverpass(query);
      const result = overpassSchema.parse(rawResult);
      if (result.remark && curatedMatches.length === 0) {
        throw new Error(
          "Nearby-place lookup is busy. Please try again shortly.",
        );
      }
      if (result.remark) degraded = true;
      elements = (result.elements || []) as OverpassElementLike[];
      elementSource = "overpass";
    } catch (err) {
      if (curatedMatches.length > 0) {
        degraded = true;
        console.warn(
          "Overpass unavailable; using curated destination landmarks.",
        );
        elements = [];
      } else {
        throw err;
      }
    }
  }

  const seen = new Map<string, Coordinate[]>();
  const places: NearbyPlace[] = [];

  if (elements.length > 0) {
    for (const item of elements) {
      const tags = item.tags || {};
      const lat = item.lat ?? item.center?.lat,
        lng = item.lon ?? item.center?.lon;
      const name = tags["name"];
      if (
        !name ||
        !isSanePlaceName(name) ||
        lat == null ||
        lng == null ||
        tags["access"] === "private" ||
        tags["disused"] === "yes"
      )
        continue;
      const point = { lat, lng };
      const normalized = name.toLowerCase();
      if (seen.get(normalized)?.some((p) => distanceKm(p, point) < 0.2))
        continue;
      seen.set(normalized, [...(seen.get(normalized) || []), point]);
      const category = /^(hotel|guest_house|hostel|motel)$/.test(
        tags["tourism"] || "",
      )
        ? "hotel"
        : /^(restaurant|cafe|fast_food|food_court|bar|pub)$/.test(
              tags["amenity"] || "",
            )
          ? "restaurant"
          : "attraction";
      const fromRoute = path.length ? distanceToRoute(point, path) : undefined;
      const distance = distanceKm(center, point);
      if (fromRoute != null ? fromRoute > 1.5 : distance > radiusKm) continue;
      const kind =
        tags["natural"] === "beach"
          ? "beach"
          : tags["tourism"] ||
            tags["historic"] ||
            tags["natural"] ||
            tags["leisure"] ||
            tags["amenity"] ||
            "place";

      const NON_SCHEDULABLE_KINDS =
        /^(hotel|guest_house|hostel|apartment|motel|bank|school|clinic|fuel|parking)$/i;
      if (
        NON_SCHEDULABLE_KINDS.test(tags["tourism"] || "") ||
        NON_SCHEDULABLE_KINDS.test(tags["amenity"] || "") ||
        NON_SCHEDULABLE_KINDS.test(tags["building"] || "") ||
        NON_SCHEDULABLE_KINDS.test(kind) ||
        category === "hotel"
      ) {
        continue;
      }

      places.push({
        ...point,
        id: `${item.type}/${item.id}`,
        name,
        category,
        kind,
        openingHours: tags["opening_hours"],
        cuisine: tags["cuisine"],
        distanceKm: distance,
        routeDistanceKm: fromRoute,
        sourceUrl: `https://www.openstreetmap.org/${item.type}/${item.id}`,
        hasWikipedia: Boolean(tags["wikipedia"]),
        hasWikidata: Boolean(tags["wikidata"]),
        hasWebsite: Boolean(tags["website"] || tags["contact:website"]),
        source: elementSource,
      });
      const maxCap = elementSource === "catalogue" ? 5000 : 500;
      if (places.length >= maxCap) break;
    }
  } else if (curatedMatches.length > 0) {
    // When Overpass returns 0 elements or failed, use curated landmark database
    for (const c of curatedMatches) {
      places.push({
        ...c,
        source: "curated",
      });
    }
  }
  const parsedOsm = places.filter((p) => p.source === "overpass");
  const parsedCatalogue = places.filter((p) => p.source === "catalogue");
  const parsedCurated = places.filter(
    (p) => p.source === "curated" || p.id.startsWith("curated/"),
  );
  if (process.env["ITINERARY_DEBUG"] === "1") {
    console.log(
      `[nearbyPlacesWithMeta] Candidates parsed: total=${places.length} (catalogue: ${parsedCatalogue.length}, Overpass: ${parsedOsm.length}, curated: ${parsedCurated.length})`,
    );
  }
  places.sort((a, b) => a.distanceKm - b.distanceKm);
  if (!degraded) await setCached(`nearby:${key}`, places, 86400);
  return { places, degraded };
}

export async function nearbyPlaces(
  center: Coordinate,
  radiusKm = 5,
  path: Coordinate[] = [],
): Promise<NearbyPlace[]> {
  const { places } = await nearbyPlacesWithMeta(center, radiusKm, path);
  return places;
}

export async function drivingMatrix(points: Coordinate[]) {
  const base = (
    process.env["OSRM_BASE_URL"] || "https://router.project-osrm.org"
  ).replace(/\/$/, "");
  const cell = z.number().nonnegative().nullable();
  const result = z
    .object({
      code: z.string(),
      durations: z.array(z.array(cell)).optional(),
      distances: z.array(z.array(cell)).optional(),
      sources: z
        .array(z.object({ distance: z.number() }).nullable())
        .optional(),
    })
    .parse(
      await fetchJson(
        `${base}/table/v1/driving/${points.map((p) => `${p.lng},${p.lat}`).join(";")}?annotations=duration,distance`,
      ),
    );
  if (
    result.code !== "Ok" ||
    result.durations?.length !== points.length ||
    result.distances?.length !== points.length ||
    result.durations.some((row) => row.length !== points.length) ||
    result.distances.some((row) => row.length !== points.length)
  ) {
    throw new Error(
      "Road travel times are unavailable. Please retry; a timed itinerary cannot be verified without routing.",
    );
  }
  // Reject remote road snaps (e.g. a waterfall across an inaccessible forest).
  const reachable = points.map(
    (_, i) => (result.sources?.[i]?.distance ?? Infinity) <= 1000,
  );
  return {
    durations: result.durations,
    distances: result.distances,
    reachable,
  };
}

export interface PlaceDetailsResult {
  openingHours?: string | undefined;
  phone?: string | undefined;
  website?: string | undefined;
  cuisine?: string | undefined;
}

export async function getPlaceDetailsServer({
  lat,
  lng,
  name,
}: {
  lat: number;
  lng: number;
  name: string;
}): Promise<PlaceDetailsResult> {
  try {
    const query = `[out:json][timeout:6];nwr(around:50,${lat},${lng})["name"];out tags 15;`;
    const raw = await fetchOverpass(query);
    const result = overpassSchema.parse(raw);
    const elements = result.elements || [];

    const targetLower = name.trim().toLowerCase();
    const match = elements.find((el) => {
      const elName = (el.tags?.["name"] || "").trim().toLowerCase();
      return elName === targetLower;
    });

    if (!match || !match.tags) {
      return {};
    }

    const tags = match.tags;
    const openingHours = tags["opening_hours"]?.trim() || undefined;
    const phone = (tags["phone"] || tags["contact:phone"])?.trim() || undefined;
    const website =
      (tags["website"] || tags["contact:website"])?.trim() || undefined;
    const cuisine = tags["cuisine"]?.trim() || undefined;

    return {
      openingHours,
      phone,
      website,
      cuisine,
    };
  } catch {
    return {};
  }
}

const essentialSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  kind: z.enum(["hospital", "police", "pharmacy", "clinic"]),
  distanceKm: z.number(),
  openingHours: z.string().optional(),
});
export type NearbyEssential = z.infer<typeof essentialSchema>;
export async function nearbyEssentials(
  center: Coordinate,
): Promise<NearbyEssential[] | null> {
  const key = `essentials:${center.lat.toFixed(3)},${center.lng.toFixed(3)}`;
  try {
    const cached = z.array(essentialSchema).safeParse(await getCached(key));
    if (cached.success) return cached.data;
    const result = overpassSchema.parse(
      await fetchOverpass(
        `[out:json][timeout:6];nwr(around:10000,${center.lat},${center.lng})["amenity"~"^(hospital|police|pharmacy|clinic)$"];out center tags 60;`,
      ),
    );
    if (result.remark) return null;
    const byKind = new Map<string, NearbyEssential[]>();
    for (const element of result.elements) {
      const tags = element.tags || {};
      const name = tags["name"];
      if (
        !name ||
        !isSanePlaceName(name) ||
        tags["access"] === "private" ||
        tags["disused"] === "yes"
      )
        continue;
      const point = essentialSchema.safeParse({
        name,
        kind: tags["amenity"],
        lat: element.lat ?? element.center?.lat,
        lng: element.lon ?? element.center?.lon,
        distanceKm: 0,
        openingHours: tags["opening_hours"],
      });
      if (!point.success) continue;
      const item = {
        ...point.data,
        distanceKm: distanceKm(center, point.data),
      };
      if (item.distanceKm > 10) continue;
      const list = byKind.get(item.kind) || [];
      list.push(item);
      byKind.set(item.kind, list);
    }
    const categories: Array<"hospital" | "police" | "pharmacy" | "clinic"> = [
      "hospital",
      "police",
      "pharmacy",
      "clinic",
    ];
    const items: NearbyEssential[] = [];
    for (const cat of categories) {
      const list = byKind.get(cat);
      if (list && list.length > 0) {
        list.sort((a, b) => a.distanceKm - b.distanceKm);
        items.push(...list.slice(0, 3));
      }
    }
    await setCached(key, items, 86400);
    return items;
  } catch (err) {
    console.error(
      "[places] nearbyEssentials failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
