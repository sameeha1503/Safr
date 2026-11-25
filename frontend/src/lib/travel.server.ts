import { normalizePlaceName } from "./place-names";
import { matchCuratedPlace } from "./curated-match";
import { lookupWikipedia } from "./wikipedia.server";
import { z } from "zod";
import { itineraryInputSchema } from "./travel-schemas";
import { itinerarySchema, placeInsightsSchema } from "./goa-schemas";
import { getPlaceRules } from "./place-rules";
import {
  locatePlace,
  nearbyPlaces,
  nearbyPlacesWithMeta,
  drivingMatrix,
  fetchJson,
} from "./places.server";
import { computeSafeRoutes, type ScoredRoute } from "./maps.server";
import { explainRouteChoice } from "./route-choice";
import {
  itineraryMode,
  planDay,
  matchesInterest,
  buildSlotPlan,
  isOpenAt,
  scoreCandidate,
  sunsetMinutes,
  humanizeKind,
  humanizeCuisine,
  cleanWhy,
  dedupeNearDuplicates,
  isLikelyDining,
  isNightlifeVenue,
  type CandidateScoreContext,
} from "./itinerary-engine";
import { scheduleItinerary, formatPlanTime } from "./itinerary-planner";
import { CURATED_GOA_PLACES } from "./goa-places-data";
import {
  distanceKm,
  distanceToRoute,
  type Coordinate,
  type NearbyPlace,
} from "./geo";

export async function buildItinerary(
  raw: z.input<typeof itineraryInputSchema>,
) {
  const input = itineraryInputSchema.parse(raw);
  // `origin` is a legacy single-point anchor and must never stand in for the destination when a separate start exists.
  const destination =
    input.destination ||
    (input.start ? undefined : input.origin) ||
    (await locatePlace(input.place, input.state));
  const start = input.start;
  const mode = itineraryMode(start, destination);

  const startHour = Number(input.startTime.split(":")[0] || 9);
  const isNight = startHour < 6 || startHour >= 19;

  let scoredRoute: ScoredRoute | undefined;
  let allRoutes: ScoredRoute[] = [];
  let corridorCandidates: NearbyPlace[] = [];
  let corridorDegraded = false;

  const searchRadius =
    mode === "journey" ? 6 : Math.min(18, Math.max(5, input.hours * 2));

  let destPlaces: NearbyPlace[] = [];
  let destDegraded = false;

  if (mode === "journey" && start) {
    // 1. Journey mode: compute routes and destination search in parallel
    const [routesResult, destResult] = await Promise.all([
      computeSafeRoutes(start, destination, isNight).catch((err) => {
        console.warn(
          "[itinerary] computeSafeRoutes fallback:",
          err instanceof Error ? err.message : err,
        );
        return [] as ScoredRoute[];
      }),
      nearbyPlacesWithMeta(destination, searchRadius),
    ]);

    allRoutes = routesResult;
    destPlaces = destResult.places;
    destDegraded = destResult.degraded;

    scoredRoute =
      routesResult.find((r) => r.isSafest) ||
      routesResult.find((r) => r.isFastest) ||
      routesResult[0];

    if (scoredRoute) {
      let pathCoords: Coordinate[] = [];
      try {
        const rawCoords = JSON.parse(scoredRoute.polyline) as [
          number,
          number,
        ][];
        pathCoords = rawCoords.map(([lat, lng]) => ({ lat, lng }));
      } catch {
        pathCoords = [start, destination];
      }

      if (pathCoords.length > 0) {
        if (scoredRoute.distanceKm > 25 && pathCoords.length >= 6) {
          const chunkCount = Math.min(
            3,
            Math.ceil(scoredRoute.distanceKm / 20),
          );
          const chunkSize = Math.ceil(pathCoords.length / chunkCount);
          const chunkPromises: Promise<{
            places: NearbyPlace[];
            degraded: boolean;
          }>[] = [];

          for (let i = 0; i < chunkCount; i++) {
            const startIdx = i * chunkSize;
            const endIdx = Math.min(pathCoords.length, (i + 1) * chunkSize + 1);
            const chunk = pathCoords.slice(startIdx, endIdx);
            if (chunk.length > 0) {
              const center = chunk[Math.floor(chunk.length / 2)]!;
              chunkPromises.push(nearbyPlacesWithMeta(center, 5, chunk));
            }
          }

          const chunkResults = await Promise.all(chunkPromises);
          const corridorMap = new Map<string, NearbyPlace>();
          for (const res of chunkResults) {
            if (res.degraded) corridorDegraded = true;
            for (const p of res.places) {
              if (
                !corridorMap.has(p.id) &&
                distanceToRoute(p, pathCoords) <= 1.5
              ) {
                corridorMap.set(p.id, p);
              }
            }
          }
          corridorCandidates = Array.from(corridorMap.values());
        } else {
          const center =
            pathCoords[Math.floor(pathCoords.length / 2)] || destination;
          const res = await nearbyPlacesWithMeta(center, 10, pathCoords);
          if (res.degraded) corridorDegraded = true;
          corridorCandidates = res.places.filter(
            (p) => distanceToRoute(p, pathCoords) <= 1.5,
          );
        }
      }
    }
  } else {
    // Anchor mode
    const destResult = await nearbyPlacesWithMeta(destination, searchRadius);
    destPlaces = destResult.places;
    destDegraded = destResult.degraded;
  }

  const degraded = destDegraded || corridorDegraded;

  // Supplement live results with known nearby landmarks, regardless of provider IDs.
  const curatedNear = CURATED_GOA_PLACES.map((p) => ({
    ...p,
    distanceKm: distanceKm(destination, p),
  })).filter((p) => p.distanceKm <= searchRadius * 1.5);
  const existingIds = new Set(destPlaces.map((p) => p.id));
  const rawPlaces = [
    ...destPlaces,
    ...curatedNear.filter((p) => !existingIds.has(p.id)),
  ];
  const places = dedupeNearDuplicates(rawPlaces);

  const countSources = (
    items: {
      id?: string | undefined;
      sourceUrl?: string | undefined;
      source?: string | undefined;
    }[],
  ) => {
    let curated = 0;
    let osm = 0;
    let catalogue = 0;
    for (const item of items) {
      if (item.source === "catalogue") {
        catalogue++;
      } else if (
        item.id?.startsWith("curated/") ||
        item.source === "curated" ||
        (item.sourceUrl && !item.sourceUrl.includes("openstreetmap.org"))
      ) {
        curated++;
      } else {
        osm++;
      }
    }
    return { curated, osm, catalogue, total: items.length };
  };

  // Stage 1: after Overpass/catalogue parsing
  const stage1 = countSources([...destPlaces, ...corridorCandidates]);
  if (process.env["ITINERARY_DEBUG"] === "1") {
    console.log(
      `[itinerary] Stage 1 (after place parsing): total=${stage1.total} (catalogue: ${stage1.catalogue}, curated: ${stage1.curated}, OSM: ${stage1.osm})`,
    );
  }

  // Stage 2: after merging curated places
  const stage2 = countSources(places);
  if (process.env["ITINERARY_DEBUG"] === "1") {
    console.log(
      `[itinerary] Stage 2 (after merging curated places): total=${stage2.total} (catalogue: ${stage2.catalogue}, curated: ${stage2.curated}, OSM: ${stage2.osm})`,
    );
  }

  const scoreCtx: CandidateScoreContext = {
    interests: input.interests,
    notes: input.notes,
    center: destination,
  };

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
    noteMatchedPlaces.sort(
      (a, b) =>
        scoreCandidate(b, scoreCtx) - scoreCandidate(a, scoreCtx) ||
        a.distanceKm - b.distanceKm,
    );
  }

  // 2. Stratified selection per selected user interest (sorted by scoreCandidate descending)
  const selectedInterestBuckets = new Map<string, NearbyPlace[]>();
  for (const interest of input.interests) {
    const matches = places
      .filter((p) => p.category !== "hotel" && matchesInterest(p, interest))
      .sort(
        (a, b) =>
          scoreCandidate(b, scoreCtx) - scoreCandidate(a, scoreCtx) ||
          a.distanceKm - b.distanceKm,
      );
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

  // Ensure destination landmark is included in candidates
  const destMatch = places.find(
    (p) =>
      (input.place &&
        (p.name.toLowerCase() === input.place.toLowerCase() ||
          p.name.toLowerCase().includes(input.place.toLowerCase()) ||
          input.place.toLowerCase().includes(p.name.toLowerCase()))) ||
      distanceKm(p, destination) < 0.2,
  );
  if (destMatch) {
    addCandidate(destMatch);
  }

  // Specific user-requested places get first priority
  for (const p of noteMatchedPlaces) {
    if (candidates.length >= 6) break;
    addCandidate(p);
  }

  // Round-robin interest allocation so every selected interest gets 3-4 top candidates
  const quotaPerInterest = Math.max(
    2,
    Math.floor(28 / Math.max(1, input.interests.length)),
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

  // Fill remaining slots up to 40 with highest-scoring remaining places
  const remainingPool = places
    .filter((p) => p.category !== "hotel" && !candidateSet.has(p.id))
    .sort(
      (a, b) =>
        scoreCandidate(b, scoreCtx) - scoreCandidate(a, scoreCtx) ||
        a.distanceKm - b.distanceKm,
    );

  for (const p of remainingPool) {
    if (candidates.length >= 40) break;
    addCandidate(p);
  }

  // Final ~40-candidate shortlist sorted by scoreCandidate (highest first), never by catalogue order or id
  candidates.sort(
    (a, b) =>
      scoreCandidate(b, scoreCtx) - scoreCandidate(a, scoreCtx) ||
      a.distanceKm - b.distanceKm,
  );

  // Stage 3: after interest filtering
  const stage3 = countSources(candidates);
  if (process.env["ITINERARY_DEBUG"] === "1") {
    console.log(
      `[itinerary] Stage 3 (after interest filtering): total=${stage3.total} (catalogue: ${stage3.catalogue}, curated: ${stage3.curated}, OSM: ${stage3.osm})`,
    );
  }

  if (!candidates.length)
    throw new Error(
      "No mapped attractions or restaurants were found nearby. Try a nearby town or another starting point.",
    );

  const base = start || destination;
  const matrix = await drivingMatrix([base, ...candidates]);

  const slotDefinitions = buildSlotPlan({
    mode,
    startTime: input.startTime,
    hours: input.hours,
    pace: input.pace,
    date: input.date,
    destinationCoords: destination,
    driveMinutesTotal: scoredRoute?.durationMin ?? 0,
  });

  const slotShortlists = new Map<
    string,
    {
      id: string;
      name: string;
      category: string;
      kind: string;
      cuisine?: string | undefined;
      highlight?: string | undefined;
      distanceKm: number;
      detourMin: number;
      openStatus: string;
    }[]
  >();

  for (const s of slotDefinitions) {
    let pool: NearbyPlace[] = [];
    if (s.slot === "arrive") {
      pool = destMatch ? [destMatch] : candidates.slice(0, 1);
    } else if (s.slot === "en-route") {
      pool = corridorCandidates.filter(
        (p) =>
          p.category !== "hotel" &&
          (p.routeDistanceKm == null || p.routeDistanceKm <= 1.5) &&
          distanceKm(p, destination) >= 3.0,
      );
    } else if (s.slot === "meal") {
      pool = candidates.filter(
        (p) =>
          isLikelyDining(p) &&
          (input.interests.includes("Nightlife") || !isNightlifeVenue(p)) &&
          (p.category === "restaurant" ||
            ["restaurant", "cafe", "fast_food"].includes(p.kind)),
      );
    } else if (s.slot === "sunset") {
      pool = candidates.filter(
        (p) =>
          p.category !== "hotel" &&
          (p.bestTime === "sunset" ||
            ["beach", "viewpoint", "fort", "lighthouse"].includes(p.kind) ||
            p.name.toLowerCase().includes("beach") ||
            p.name.toLowerCase().includes("sunset")),
      );
      if (pool.length === 0)
        pool = candidates.filter((p) => p.category !== "hotel");
    } else {
      pool = candidates.filter((p) => p.category !== "hotel");
    }

    if (s.slot !== "arrive" && s.slot !== "meal") {
      const allowNightlife =
        input.interests.includes("Nightlife") && s.windowStartMin >= 19 * 60;
      if (!allowNightlife) {
        pool = pool.filter((p) => !isNightlifeVenue(p));
      }
    }

    const shortlist = pool
      .map((p) => {
        const detourMin =
          p.routeDistanceKm != null
            ? Math.round((p.routeDistanceKm / 35) * 60 * 2)
            : 0;
        const openStatus = isOpenAt(
          p.openingHours,
          input.date,
          s.targetTimeMin,
        );
        return {
          place: p,
          detourMin,
          openStatus,
          score: scoreCandidate(p, {
            interests: input.interests,
            notes: input.notes,
            center: destination,
          }),
        };
      })
      .filter((c) => c.openStatus !== "closed")
      .filter((c) => (s.slot === "en-route" ? c.detourMin <= 12 : true))
      .sort(
        (a, b) => b.score - a.score || a.place.distanceKm - b.place.distanceKm,
      )
      .slice(0, 6)
      .map((c) => ({
        id: c.place.id,
        name: c.place.name,
        category: c.place.category,
        kind: humanizeKind(c.place),
        cuisine: humanizeCuisine(c.place.cuisine),
        highlight: c.place.highlight,
        distanceKm: Math.round(c.place.distanceKm * 10) / 10,
        detourMin: c.detourMin,
        openStatus: c.openStatus,
      }));

    slotShortlists.set(s.id, shortlist);
  }

  let preferredIds = candidates.map((p) => p.id);
  const slotSelections: Record<string, { placeId: string; why: string }> = {};
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
                    "You are an expert travel itinerary selector. For each slot in the day plan, choose exactly ONE placeId from that slot's candidates shortlist.\n" +
                    "CRITICAL RULES:\n" +
                    "1. Return only JSON with 'slots': array of objects { slotId, placeId, why }.\n" +
                    "2. 'placeId' MUST be chosen strictly from that slot's candidates shortlist. Never invent an ID.\n" +
                    "3. 'why' MUST be 160 characters or less, grounded ONLY in supplied facts (e.g. kind, cuisine, detour minutes, opening hours).\n" +
                    "4. Balance user interests and notes across the chosen slots.",
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
                      slots: slotDefinitions.map((s) => ({
                        slotId: s.id,
                        slotType: s.slot,
                        timeWindow: `${formatPlanTime(s.windowStartMin)} - ${formatPlanTime(s.windowEndMin)}`,
                        candidates: slotShortlists.get(s.id) || [],
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
                properties: {
                  slots: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      required: ["slotId", "placeId", "why"],
                      properties: {
                        slotId: { type: "STRING" },
                        placeId: { type: "STRING" },
                        why: { type: "STRING" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        15000,
      )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const answer =
        response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") || "";
      const parsedJson = JSON.parse(answer);

      if (Array.isArray(parsedJson?.slots)) {
        for (const item of parsedJson.slots) {
          if (
            typeof item?.slotId === "string" &&
            typeof item?.placeId === "string"
          ) {
            const shortlist = slotShortlists.get(item.slotId) || [];
            if (shortlist.some((c: { id: string }) => c.id === item.placeId)) {
              const why =
                typeof item?.why === "string" && item.why.trim().length > 0
                  ? item.why.trim().slice(0, 160)
                  : undefined;
              slotSelections[item.slotId] = {
                placeId: item.placeId,
                why: why || "",
              };
            }
          }
        }
        if (Object.keys(slotSelections).length > 0) {
          aiStatus = "used";
        }
      } else if (Array.isArray(parsedJson?.orderedIds)) {
        const valid = new Set(candidates.map((p) => p.id));
        if (parsedJson.orderedIds.some((id: string) => !valid.has(id))) {
          throw new Error("Ungrounded AI result");
        }
        preferredIds = [
          ...new Set([
            ...parsedJson.orderedIds.filter(
              (id: unknown) => typeof id === "string",
            ),
            ...preferredIds,
          ]),
        ];
        aiStatus = "used";
      }
    } catch (error) {
      aiStatus = "unavailable";
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
    }
  }

  // Sort candidates by AI preferences
  const orderedCandidates = [...candidates].sort((a, b) => {
    const aIdx = preferredIds.indexOf(a.id);
    const bIdx = preferredIds.indexOf(b.id);
    const aRank = aIdx === -1 ? 999 : aIdx;
    const bRank = bIdx === -1 ? 999 : bIdx;
    return aRank - bRank;
  });

  const dayPlan = planDay({
    mode,
    start,
    destination: { ...destination, name: input.place },
    hours: input.hours,
    startTime: input.startTime,
    pace: input.pace,
    interests: input.interests,
    notes: input.notes,
    date: input.date,
    returnToStart: input.returnToStart,
    corridorCandidates,
    destinationCandidates: orderedCandidates,
    driveMinutesTotal: scoredRoute?.durationMin ?? 0,
    durations: matrix.durations,
    distances: matrix.distances,
    reachable: matrix.reachable,
    candidateList: candidates,
    slotSelections,
  });

  const schedule =
    dayPlan.stops.length > 0
      ? dayPlan
      : scheduleItinerary({
          ...input,
          candidates,
          ...matrix,
          preferredIds,
        });

  // Stage 6: final stops
  const stage6 = countSources(schedule.stops);
  if (process.env["ITINERARY_DEBUG"] === "1") {
    console.log(
      `[itinerary] Stage 6 (final stops): total=${stage6.total} (catalogue: ${stage6.catalogue}, curated: ${stage6.curated}, OSM: ${stage6.osm})`,
    );
  }

  if (!schedule.stops.length)
    throw new Error(
      "No reachable stop fits this time budget including driving and arrival buffers. Allow more time or choose a closer starting point.",
    );

  const tips = [
    degraded
      ? "Live place data was limited; this plan leans on curated landmarks."
      : "Driving times are OSRM estimates, without live traffic, ferry queues or road closures. Visit lengths and arrival buffers are planning allowances.",
    "Opening hours, ticket availability, dietary needs and accessibility must be confirmed with venues before travelling.",
    aiStatus === "used"
      ? "AI ranked mapped places using your interests and notes; the scheduler calculated all times."
      : aiStatus === "not_configured"
        ? "AI is not configured. This plan uses mapped places and your selected interests; free-text requests need manual checking."
        : "AI was unavailable. This plan uses mapped places and selected interests; free-text requests need manual checking.",
    "The time budget includes the initial drive and any selected return trip. Free time is deliberately left unfilled when another stop will not fit.",
    "Beach flags and swimming conditions are not available here. Follow lifeguards and posted flags at the beach.",
  ].slice(0, 6);

  let journeyData: z.infer<typeof itinerarySchema>["journey"] = undefined;
  if (mode === "journey" && start) {
    const sunsetMin = sunsetMinutes(
      input.date,
      destination.lat,
      destination.lng,
    );
    const darkThreshold = sunsetMin + 30;
    let arriveAfterDark = false;

    const [sh, sm] = input.startTime.split(":").map(Number);
    const startMin = (sh ?? 9) * 60 + (sm ?? 0);

    if (scoredRoute && startMin + scoredRoute.durationMin > darkThreshold) {
      arriveAfterDark = true;
    }
    for (const stop of schedule.stops) {
      if (stop.arrivalMinute != null && stop.arrivalMinute > darkThreshold) {
        arriveAfterDark = true;
      }
      if (
        stop.departureMinute != null &&
        stop.departureMinute > darkThreshold
      ) {
        arriveAfterDark = true;
      }
    }
    if (
      schedule.totalMinutes != null &&
      startMin + schedule.totalMinutes > darkThreshold
    ) {
      arriveAfterDark = true;
    }

    const returnDriveMin =
      schedule.returnMinutes && schedule.returnMinutes > 0
        ? schedule.returnMinutes
        : (scoredRoute?.durationMin ?? 0);
    const headingBackMin = Math.max(0, sunsetMin - returnDriveMin);
    const returnByText = `Start heading back by ${formatPlanTime(headingBackMin)} to be home before dark`;

    const safetyNotes: string[] = [];
    if (allRoutes.length > 0) {
      try {
        const choice = explainRouteChoice(allRoutes, { isNight });
        if (choice.verdict === "safer-alternative") {
          if (choice.headline) {
            safetyNotes.push(`Safer alternative: ${choice.headline}`);
          }
          for (const r of choice.reasons) {
            if (!safetyNotes.includes(r)) safetyNotes.push(r);
          }
        } else if (choice.verdict === "fastest-is-safest") {
          if (choice.headline) {
            safetyNotes.push(choice.headline);
          }
          for (const r of choice.reasons) {
            if (!safetyNotes.includes(r)) safetyNotes.push(r);
          }
        } else {
          for (const r of choice.reasons) {
            if (!safetyNotes.includes(r)) safetyNotes.push(r);
          }
        }
      } catch (err) {
        console.warn("[itinerary] explainRouteChoice error:", err);
      }
    }

    if (safetyNotes.length === 0 && scoredRoute?.reasons?.length) {
      for (const r of scoredRoute.reasons) {
        if (!safetyNotes.includes(r)) safetyNotes.push(r);
      }
    }

    if (returnByText && !safetyNotes.includes(returnByText)) {
      safetyNotes.push(returnByText);
    }
    if (arriveAfterDark) {
      const darkNote =
        "Portions of this journey are scheduled after dark. Drive with extra care on unlit roads.";
      if (!safetyNotes.includes(darkNote)) {
        safetyNotes.push(darkNote);
      }
    }

    let routeLine: [number, number][] | undefined = undefined;
    if (scoredRoute?.polyline) {
      try {
        const raw = JSON.parse(scoredRoute.polyline);
        if (Array.isArray(raw)) {
          routeLine = raw as [number, number][];
        }
      } catch {
        // ignore
      }
    }

    journeyData = {
      start,
      destination,
      routeKm: scoredRoute?.distanceKm,
      routeMin: scoredRoute?.durationMin,
      hazardZones: scoredRoute?.hazardZones?.map((z) => z.label) ?? [],
      safetyNotes,
      routeLine,
      arriveAfterDark,
      returnByText,
    };
  }

  return itinerarySchema.parse({
    title:
      mode === "journey" && start?.name
        ? `${start.name} to ${input.place}: your ${input.hours}-hour journey`
        : `${input.place}: your ${input.hours}-hour plan`,
    overview: `${schedule.stops.length} mapped stops in or near ${input.place}, ${input.state}. ${schedule.totalMinutes} minutes planned, including driving and arrival buffers; ${schedule.unusedMinutes} minutes left free. Finish by ${schedule.endTime}${input.returnToStart ? " back at your starting point" : " at the last stop"}.`,
    date: input.date,
    ...schedule,
    aiStatus,
    routingSource: "OSRM",
    origin: destination,
    mode,
    journey: journeyData,
    tips,
    degraded,
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
    const ruleSet = getPlaceRules(curated?.kind);
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
      rules: ruleSet?.rules,
      warnings: ruleSet?.warnings,
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
