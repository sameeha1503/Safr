import { normalizePlaceName } from "./place-names";
import { matchCuratedPlace } from "./curated-match";
import { lookupWikipedia } from "./wikipedia.server";
import { z } from "zod";
import { itineraryInputSchema } from "./travel-schemas";
import { itinerarySchema, placeInsightsSchema } from "./goa-schemas";
import {
  locatePlace,
  nearbyPlaces,
  drivingMatrix,
  fetchJson,
} from "./places.server";
import { scheduleItinerary } from "./itinerary-planner";
import { CURATED_GOA_PLACES } from "./goa-places-data";
import { distanceKm, type NearbyPlace } from "./geo";

function matchesInterest(p: NearbyPlace, interest: string): boolean {
  if (p.interests && p.interests.includes(interest)) return true;
  const name = p.name.toLowerCase();
  const kind = p.kind.toLowerCase();
  const isRestaurant = p.category === "restaurant";

  switch (interest) {
    case "Local food":
      return (
        isRestaurant ||
        ["restaurant", "cafe", "fast_food", "food_court", "bar"].includes(
          kind,
        ) ||
        name.includes("restaurant") ||
        name.includes("cafe") ||
        name.includes("bakery") ||
        name.includes("thali") ||
        name.includes("shack")
      );

    case "Beaches & sunsets":
      if (isRestaurant) return false;
      return (
        kind === "beach" ||
        kind === "viewpoint" ||
        kind === "lighthouse" ||
        name.includes("beach") ||
        name.includes("sunset") ||
        name.includes("cove")
      );

    case "History & heritage":
      if (isRestaurant) return false;
      return (
        [
          "museum",
          "castle",
          "fort",
          "monument",
          "ruins",
          "archaeological_site",
          "historic",
        ].includes(kind) ||
        name.includes("fort") ||
        name.includes("museum") ||
        name.includes("heritage") ||
        name.includes("ruins") ||
        name.includes("palace")
      );

    case "Nightlife":
      return (
        ["bar", "pub", "nightclub", "lounge"].includes(kind) ||
        name.includes("club") ||
        name.includes("bar") ||
        name.includes("pub") ||
        name.includes("lounge") ||
        name.includes("nightlife")
      );

    case "Nature & wildlife":
      if (isRestaurant) return false;
      return (
        ["zoo", "viewpoint", "nature_reserve", "park", "waterfall"].includes(
          kind,
        ) ||
        name.includes("waterfall") ||
        name.includes("falls") ||
        name.includes("sanctuary") ||
        name.includes("nature") ||
        name.includes("lake") ||
        name.includes("wildlife")
      );

    case "Markets & shopping":
      if (isRestaurant) return false;
      return (
        ["marketplace", "mall", "market"].includes(kind) ||
        name.includes("market") ||
        name.includes("bazaar") ||
        name.includes("flea") ||
        name.includes("mall")
      );

    case "Churches & temples":
      if (isRestaurant) return false;
      return (
        ["place_of_worship", "church", "temple", "cathedral"].includes(kind) ||
        name.includes("church") ||
        name.includes("temple") ||
        name.includes("cathedral") ||
        name.includes("basilica")
      );

    case "Water sports":
      if (isRestaurant) return false;
      return (
        [
          "water_sports",
          "water_park",
          "sports_centre",
          "scuba_diving",
          "surfing",
        ].includes(kind) ||
        name.includes("water sports") ||
        name.includes("scuba") ||
        name.includes("surf") ||
        name.includes("kayak") ||
        name.includes("parasailing") ||
        name.includes("jet ski")
      );

    default:
      return false;
  }
}

export async function buildItinerary(
  raw: z.input<typeof itineraryInputSchema>,
) {
  const input = itineraryInputSchema.parse(raw);
  const base = input.origin || (await locatePlace(input.place, input.state));

  const searchRadius = Math.min(18, Math.max(5, input.hours * 2));
  let places = await nearbyPlaces(base, searchRadius);

  // Supplement live results with known nearby landmarks, regardless of provider IDs.
  const curatedNear = CURATED_GOA_PLACES.map((p) => ({
    ...p,
    distanceKm: distanceKm(base, p),
  })).filter((p) => p.distanceKm <= searchRadius * 1.5);
  const existingIds = new Set(places.map((p) => p.id));
  places = [...places, ...curatedNear.filter((p) => !existingIds.has(p.id))];

  // 1. Prioritize user notes (specific desired works, attractions or activities)
  const notesLower = (input.notes || "").toLowerCase();
  const noteMatchedPlaces: NearbyPlace[] = [];
  if (notesLower.length > 2) {
    const keywords = notesLower
      .split(/[\s,.;]+/)
      .filter(
        (w) =>
          w.length > 3 &&
          ![
            "want",
            "need",
            "like",
            "with",
            "have",
            "some",
            "time",
            "visit",
            "trip",
          ].includes(w),
      );
    for (const p of places) {
      if (p.category === "hotel") continue;
      const combined =
        `${p.name} ${p.kind} ${p.cuisine || ""} ${p.highlight || ""}`.toLowerCase();
      if (keywords.some((k) => combined.includes(k))) {
        noteMatchedPlaces.push(p);
      }
    }
  }

  // 2. Stratified selection per selected user interest
  const selectedInterestBuckets = new Map<string, NearbyPlace[]>();
  for (const interest of input.interests) {
    const matches = places
      .filter((p) => p.category !== "hotel" && matchesInterest(p, interest))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    selectedInterestBuckets.set(interest, matches);
  }

  // 3. Assemble balanced candidates guaranteeing coverage across all selected interests
  const candidateSet = new Set<string>();
  const candidates: NearbyPlace[] = [];

  const addCandidate = (p: NearbyPlace) => {
    if (!candidateSet.has(p.id)) {
      candidateSet.add(p.id);
      candidates.push(p);
    }
  };

  // Specific user-requested places get first priority
  for (const p of noteMatchedPlaces) {
    if (candidates.length >= 6) break;
    addCandidate(p);
  }

  // Round-robin interest allocation so every selected interest gets 3-4 top candidates
  const quotaPerInterest = Math.max(
    2,
    Math.floor(16 / Math.max(1, input.interests.length)),
  );
  for (const [_, bucket] of selectedInterestBuckets) {
    let taken = 0;
    for (const p of bucket) {
      if (taken >= quotaPerInterest) break;
      if (!candidateSet.has(p.id)) {
        addCandidate(p);
        taken++;
      }
    }
  }

  // Fill remaining slots up to 20 with closest remaining attractions
  const remainingPool = places
    .filter((p) => p.category !== "hotel" && !candidateSet.has(p.id))
    .sort((a, b) => {
      const aScore = input.interests.filter((i) =>
        matchesInterest(a, i),
      ).length;
      const bScore = input.interests.filter((i) =>
        matchesInterest(b, i),
      ).length;
      return bScore - aScore || a.distanceKm - b.distanceKm;
    });

  for (const p of remainingPool) {
    if (candidates.length >= 20) break;
    addCandidate(p);
  }

  if (!candidates.length)
    throw new Error(
      "No mapped attractions or restaurants were found nearby. Try a nearby town or another starting point.",
    );
  const matrix = await drivingMatrix([base, ...candidates]);
  let preferredIds = candidates.map((p) => p.id);
  let aiStatus: "used" | "unavailable" | "not_configured" = "not_configured";
  const key = process.env["GEMINI_API_KEY"];
  if (key) {
    aiStatus = "unavailable";
    try {
      const model = process.env["GEMINI_MODEL"] || "gemini-2.5-flash";
      const response = (await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text:
                    "You are an expert travel itinerary planner. Rank and sequence the supplied map places for a tourist day trip.\n" +
                    "CRITICAL RULES:\n" +
                    "1. Return only JSON with 'orderedIds', an array of unique place IDs from the supplied list. Never invent IDs.\n" +
                    "2. Variety & Diversity: Do NOT schedule multiple consecutive restaurants or food venues back-to-back. Sequence realistically: sights/activities -> meal/cafe -> scenic beach/viewpoint -> sunset/evening relaxation.\n" +
                    "3. User Needs & Desired Works: Respect the user's notes and selected interests. Prioritize stops that accomplish their desired works.\n" +
                    "4. Representation: Include stops representing the different interests selected by the user.",
                },
              ],
            },
            contents: [
              {
                parts: [
                  {
                    text: JSON.stringify({
                      destination: input.place,
                      state: input.state,
                      interests: input.interests,
                      notes: input.notes,
                      date: input.date,
                      startTime: input.startTime,
                      hours: input.hours,
                      places: candidates.map((p) => ({
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        kind: p.kind,
                        cuisine: p.cuisine,
                        highlight: p.highlight,
                        distanceKm: Math.round(p.distanceKm * 10) / 10,
                      })),
                    }),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.6,
              responseMimeType: "application/json",
              maxOutputTokens: 2048,
              ...(model.startsWith("gemini-2.5-")
                ? { thinkingConfig: { thinkingBudget: 0 } }
                : {}),
              responseSchema: {
                type: "OBJECT",
                required: ["orderedIds"],
                properties: {
                  orderedIds: {
                    type: "ARRAY",
                    minItems: 1,
                    maxItems: candidates.length,
                    items: {
                      type: "STRING",
                    },
                  },
                },
              },
            },
          }),
        },
        30000,
      )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const answer =
        response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") || "";
      const ranked = z
        .object({ orderedIds: z.array(z.string()).min(1).max(20) })
        .parse(JSON.parse(answer));
      const valid = new Set(candidates.map((p) => p.id));
      if (ranked.orderedIds.some((id) => !valid.has(id)))
        throw new Error("Ungrounded AI result");
      // Ranking is a preference, not permission to discard reachable alternatives.
      preferredIds = [...new Set([...ranked.orderedIds, ...preferredIds])];
      aiStatus = "used";
    } catch (error) {
      // Log only a category/status, never provider response bodies, prompts or credentials.
      const status =
        error instanceof Error
          ? error.message.match(/\((\d{3})\)/)?.[1]
          : undefined;
      console.warn(
        "AI ranking unavailable:",
        status
          ? `HTTP ${status}`
          : error instanceof Error
            ? error.name
            : "Unknown error",
      );
      // Map-grounded scheduling remains available when AI is unavailable.
    }
  }
  const schedule = scheduleItinerary({
    ...input,
    candidates,
    ...matrix,
    preferredIds,
  });
  if (!schedule.stops.length)
    throw new Error(
      "No reachable stop fits this time budget including driving and arrival buffers. Allow more time or choose a closer starting point.",
    );
  return itinerarySchema.parse({
    title: `${input.place}: your ${input.hours}-hour plan`,
    overview: `${schedule.stops.length} mapped stops in or near ${input.place}, ${input.state}. ${schedule.totalMinutes} minutes planned, including driving and arrival buffers; ${schedule.unusedMinutes} minutes left free. Finish by ${schedule.endTime}${input.returnToStart ? " back at your starting point" : " at the last stop"}.`,
    date: input.date,
    ...schedule,
    aiStatus,
    routingSource: "OSRM",
    origin: base,
    tips: [
      "Driving times are OSRM estimates, without live traffic, ferry queues or road closures. Visit lengths and arrival buffers are planning allowances.",
      "Opening hours, ticket availability, dietary needs and accessibility must be confirmed with venues before travelling.",
      aiStatus === "used"
        ? "AI ranked mapped places using your interests and notes; the scheduler calculated all times."
        : aiStatus === "not_configured"
          ? "AI is not configured. This plan uses mapped places and your selected interests; free-text requests need manual checking."
          : "AI was unavailable. This plan uses mapped places and selected interests; free-text requests need manual checking.",
      "The time budget includes the initial drive and any selected return trip. Free time is deliberately left unfilled when another stop will not fit.",
      "Beach flags and swimming conditions are not available here. Follow lifeguards and posted flags at the beach.",
    ],
  });
}

/** Core intentionally does not wait for nearby-place or routing providers. */
export async function loadPlaceInsights(place: string) {
  try {
    const base = await locatePlace(place, "Goa", 1000);
    const curated = matchCuratedPlace(
      base.name,
      base.lat,
      base.lng,
      CURATED_GOA_PLACES,
    );
    // Bound the optional article wait so the resolved hero can paint within the 2s target.
    // The lookup may finish caching in the background for a subsequent visit.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wikipedia = await Promise.race([
      lookupWikipedia(base),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 800);
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
    return placeInsightsSchema.parse({
      place: base.name,
      location: base,
      summary:
        [curated?.highlight, wikipedia?.extract].filter(Boolean).join(" ") ||
        `${curated?.kind || "Place"} in ${base.name}, ${base.state}.`,
      curated: curated
        ? {
            highlight: curated.highlight,
            bestTime: curated.bestTime,
            interests: curated.interests,
            kind: curated.kind,
          }
        : undefined,
      seasonNotes: curated?.seasonNotes,
      wikipedia: wikipedia || undefined,
      media: wikipedia?.imageUrl
        ? {
            imageUrl: wikipedia.imageUrl,
            credit: {
              label: "Wikipedia / Wikimedia — view image attribution",
              url: wikipedia.pageUrl,
            },
          }
        : undefined,
      eat: [],
      activities: [],
      sights: [],
    });
  } catch {
    return null;
  }
}

export async function loadPlaceNearby(base: {
  name: string;
  lat: number;
  lng: number;
}) {
  try {
    const places = (await nearbyPlaces(base, 5)).filter(
      (place) => place.distanceKm <= 5,
    );
    // Keep the Explore merge local: itinerary routing retains its existing candidate set.
    for (const curated of CURATED_GOA_PLACES) {
      const distance = distanceKm(base, curated);
      if (
        distance <= 5 &&
        !places.some(
          (place) =>
            normalizePlaceName(place.name) ===
              normalizePlaceName(curated.name) &&
            distanceKm(place, curated) < 0.3,
        )
      ) {
        places.push({ ...curated, distanceKm: distance });
      }
    }
    places.sort((a, b) => a.distanceKm - b.distanceKm);
    const recommend = (p: NearbyPlace) => ({
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      sourceUrl: p.sourceUrl,
      kind: p.kind,
      openingHours: p.openingHours,
      distanceKm: p.distanceKm,
      description: `${p.kind.replaceAll("_", " ")} · ${p.distanceKm.toFixed(1)} km straight-line distance from ${base.name}.`,
      tip: p.openingHours
        ? `Listed opening hours: ${p.openingHours}. Confirm before visiting.`
        : "Opening hours unavailable. Check with the venue before visiting.",
    });
    return {
      osmCount: places.filter((place) => !place.id.startsWith("curated/"))
        .length,
      curatedCount: places.filter((place) => place.id.startsWith("curated/"))
        .length,
      eat: places
        .filter((p) => p.category === "restaurant")
        .slice(0, 6)
        .map(recommend),
      activities: places
        .filter((p) =>
          ["marketplace", "gallery", "theme_park", "zoo"].includes(p.kind),
        )
        .slice(0, 6)
        .map(recommend),
      sights: places
        .filter(
          (p) =>
            p.category === "attraction" &&
            !["marketplace", "gallery", "theme_park", "zoo"].includes(p.kind),
        )
        .slice(0, 6)
        .map(recommend),
    };
  } catch {
    return null;
  }
}
