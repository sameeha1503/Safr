import { distanceKm, type Coordinate, type NearbyPlace } from "./geo";
import { formatPlanTime, type PlanStop } from "./itinerary-planner";

export type ItineraryMode = "journey" | "anchor";

export interface CandidateScoreContext {
  interests: string[];
  notes?: string | undefined;
  targetKind?: string | undefined;
  center?: Coordinate | undefined;
}

export interface SlotDefinition {
  id: string;
  slot: "en-route" | "main" | "meal" | "sunset" | "arrive";
  targetTimeMin: number;
  windowStartMin: number;
  windowEndMin: number;
  durationMin: number;
}

export interface PlanDayInput {
  mode: ItineraryMode;
  start?: (Coordinate & { name?: string | undefined }) | undefined;
  destination: Coordinate & { name?: string | undefined };
  hours: number;
  startTime: string;
  pace: "relaxed" | "balanced" | "packed";
  interests: string[];
  notes?: string | undefined;
  date?: string | undefined;
  returnToStart?: boolean | undefined;
  corridorCandidates?: NearbyPlace[] | undefined;
  destinationCandidates: NearbyPlace[];
  driveMinutesTotal?: number | undefined;
  excludeIds?: string[] | undefined;
  durations?: (number | null)[][] | undefined;
  distances?: (number | null)[][] | undefined;
  reachable?: boolean[] | undefined;
  candidateList?: NearbyPlace[] | undefined;
  slotSelections?: Record<string, { placeId: string; why: string }> | undefined;
}

export interface PlanDayResult {
  stops: PlanStop[];
  totalMinutes: number;
  unusedMinutes: number;
  returnMinutes: number;
  budgetMinutes: number;
  endTime: string;
}

const DEDUPE_STOPWORDS = new Set([
  "the",
  "of",
  "and",
  "in",
  "at",
  "to",
  "for",
  "a",
  "an",
  "&",
]);

function getDedupeTokens(name: string): Set<string> {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^\p{L}\p{N}\s]/gu, " "); // strip punctuation
  const tokens = normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !DEDUPE_STOPWORDS.has(t));
  return new Set(tokens);
}

function computeJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const token of a) {
    if (!b.has(token)) return false;
  }
  return true;
}

function areNearDuplicates(a: NearbyPlace, b: NearbyPlace): boolean {
  const d = distanceKm(a, b);
  if (d > 2.0) return false;

  const tokensA = getDedupeTokens(a.name);
  const tokensB = getDedupeTokens(b.name);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return false;
  }

  // (b) within 2 km and token sets exactly equal
  if (setsEqual(tokensA, tokensB)) {
    return true;
  }

  // (a) within 350 m and Jaccard overlap >= 0.6
  if (d <= 0.35) {
    const jaccard = computeJaccard(tokensA, tokensB);
    if (jaccard >= 0.6) return true;
  }

  return false;
}

function isCurated(p: NearbyPlace): boolean {
  return p.source === "curated" || p.id.startsWith("curated/");
}

function compareDescription(a: NearbyPlace, b: NearbyPlace): number {
  const aCurated = isCurated(a);
  const bCurated = isCurated(b);
  if (aCurated !== bCurated) return aCurated ? 1 : -1;

  const aWiki = Boolean(a.hasWikipedia);
  const bWiki = Boolean(b.hasWikipedia);
  if (aWiki !== bWiki) return aWiki ? 1 : -1;

  const aData = Boolean(a.hasWikidata);
  const bData = Boolean(b.hasWikidata);
  if (aData !== bData) return aData ? 1 : -1;

  const aWeb = Boolean(a.hasWebsite);
  const bWeb = Boolean(b.hasWebsite);
  if (aWeb !== bWeb) return aWeb ? 1 : -1;

  return 0;
}

export function dedupeNearDuplicates(places: NearbyPlace[]): NearbyPlace[] {
  const result: NearbyPlace[] = [];

  for (const place of places) {
    const matchIdx = result.findIndex((existing) =>
      areNearDuplicates(existing, place),
    );
    if (matchIdx === -1) {
      result.push(place);
    } else {
      const existing = result[matchIdx]!;
      if (compareDescription(place, existing) > 0) {
        result[matchIdx] = place;
      }
    }
  }

  return result;
}

const NON_DINING_REGEX =
  /\b(cook(ing|ery)|class(es)?|school|academy|institute|college|training|workshop|tuition|coaching)\b/i;

export function isLikelyDining(place: { name: string }): boolean {
  return !NON_DINING_REGEX.test(place.name);
}

const NIGHTLIFE_KINDS = new Set(["nightclub", "bar", "pub", "lounge"]);

export function isNightlifeVenue(place: { kind?: string }): boolean {
  return place.kind ? NIGHTLIFE_KINDS.has(place.kind.toLowerCase()) : false;
}

/**
 * Determine planning mode: journey when start exists and is >= 4 km from destination.
 */
export function itineraryMode(
  start?: Coordinate | null,
  destination?: Coordinate | null,
): ItineraryMode {
  if (!start || !destination) return "anchor";
  return distanceKm(start, destination) >= 4 ? "journey" : "anchor";
}

/**
 * Calculate sunset minutes after midnight in Indian Standard Time (IST, UTC+5:30)
 * using the standard NOAA solar approximation.
 * For Goa (lat ~15.5, lng ~73.8), gives ~18:15–18:40 in Nov–Jan, ~19:00–19:15 in May.
 */
export function sunsetMinutes(
  dateIso?: string,
  lat: number = 15.4989,
  lng: number = 73.8278,
): number {
  let year = 2026,
    month = 1,
    day = 15;
  if (dateIso) {
    const parts = dateIso.split("-").map(Number);
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      year = parts[0]!;
      month = parts[1]!;
      day = parts[2]!;
    }
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
  }

  const dateUtc = new Date(Date.UTC(year, month - 1, day));
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const dayOfYear =
    Math.floor((dateUtc.getTime() - startOfYear.getTime()) / 86400000) + 1;

  // Fractional year in radians
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);

  // Equation of time in minutes
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar declination in radians
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma);

  const latRad = (lat * Math.PI) / 180;
  // Standard solar zenith: 90.833 degrees (accounting for atmospheric refraction)
  const zenithRad = (90.833 * Math.PI) / 180;

  const cosHa =
    Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(decl)) -
    Math.tan(latRad) * Math.tan(decl);

  const ha = (Math.acos(Math.max(-1, Math.min(1, cosHa))) * 180) / Math.PI;

  // Solar noon in UTC minutes from midnight
  const solarNoonUtc = 720 - 4 * lng - eqtime;
  // Sunset in UTC minutes
  const sunsetUtc = solarNoonUtc + ha * 4;
  // IST is UTC + 5:30 (+330 minutes)
  const sunsetIst = sunsetUtc + 330;

  return Math.round(sunsetIst);
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const DAY_ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function parseDayRange(part: string): Set<string> | null {
  const result = new Set<string>();
  const tokens = part.split(",").map((s) => s.trim());
  for (const token of tokens) {
    if (token.includes("-")) {
      const [start, end] = token.split("-").map((s) => s.trim());
      const sIdx = (DAY_ORDER as readonly string[]).indexOf(start ?? "");
      const eIdx = (DAY_ORDER as readonly string[]).indexOf(end ?? "");
      if (sIdx === -1 || eIdx === -1) return null;
      if (sIdx <= eIdx) {
        for (let i = sIdx; i <= eIdx; i++) result.add(DAY_ORDER[i]!);
      } else {
        for (let i = sIdx; i < DAY_ORDER.length; i++) result.add(DAY_ORDER[i]!);
        for (let i = 0; i <= eIdx; i++) result.add(DAY_ORDER[i]!);
      }
    } else {
      if (!(DAY_ORDER as readonly string[]).includes(token)) return null;
      result.add(token);
    }
  }
  return result;
}

const EXOTIC_HOURS_PATTERN =
  /\b(PH|SH|sunrise|sunset|dawn|dusk|week)\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;

/**
 * Pure, conservative opening_hours parser.
 * Timezone-safe: calculates day of week using Date.UTC so behavior is identical
 * under TZ=UTC and TZ=Asia/Kolkata. Missing, unparsable or exotic rules -> "unknown", never "open".
 */
export function isOpenAt(
  openingHours: string | undefined,
  dateIso: string | undefined,
  minuteOfDay: number,
): "open" | "closed" | "unknown" {
  if (!openingHours || typeof openingHours !== "string") return "unknown";
  const clean = openingHours.trim();
  if (clean === "24/7") return "open";
  if (/^closed$/i.test(clean)) return "closed";

  // Any rule containing PH, SH, months, sunrise/sunset, week numbers, or "off"/"closed" modifiers
  // must return "unknown" (never "closed" or false "open").
  if (EXOTIC_HOURS_PATTERN.test(clean)) return "unknown";
  if (/\b(off|closed)\b/i.test(clean)) return "unknown";

  let year = 2026,
    month = 11,
    day = 24;
  if (dateIso) {
    const parts = dateIso.split("-").map(Number);
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      year = parts[0]!;
      month = parts[1]!;
      day = parts[2]!;
    }
  }
  const dayName =
    WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!;

  const clauses = clean
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  let hasDaySpec = false;
  let matchedDay = false;

  for (const clause of clauses) {
    const match = clause.match(
      /^([A-Za-z,\s-]+)?\s*(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/i,
    );
    if (!match) return "unknown";
    const daysStr = match[1]?.trim();
    const timesStr = match[2]?.trim();
    if (!timesStr) return "unknown";

    let daysSet: Set<string> | null = null;
    if (daysStr) {
      daysSet = parseDayRange(daysStr);
      if (!daysSet) return "unknown";
      hasDaySpec = true;
    }

    if (!daysSet || daysSet.has(dayName)) {
      matchedDay = true;
      const intervals = timesStr.split(",").map((s) => s.trim());
      let insideInterval = false;
      for (const inv of intervals) {
        const [startStr, endStr] = inv.split("-").map((s) => s.trim());
        if (!startStr || !endStr) return "unknown";
        const [sh, sm] = startStr.split(":").map(Number);
        const [eh, em] = endStr.split(":").map(Number);
        if (
          sh == null ||
          sm == null ||
          eh == null ||
          em == null ||
          !Number.isFinite(sh) ||
          !Number.isFinite(sm) ||
          !Number.isFinite(eh) ||
          !Number.isFinite(em)
        )
          return "unknown";

        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        if (endMin < startMin) {
          // Overnight shift e.g. 22:00-02:00
          if (minuteOfDay >= startMin || minuteOfDay < endMin) {
            insideInterval = true;
          }
        } else {
          if (minuteOfDay >= startMin && minuteOfDay < endMin) {
            insideInterval = true;
          }
        }
      }
      if (insideInterval) return "open";
    }
  }

  if (matchedDay || hasDaySpec) return "closed";
  return "unknown";
}

export function matchesInterest(p: NearbyPlace, interest: string): boolean {
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

    case "Culture & history":
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

/**
 * Deterministic candidate scoring:
 * interest match + notability (curated > wikipedia/wikidata > website/hours > bare name) - detour/distance penalty.
 */
export function scoreCandidate(
  place: NearbyPlace,
  ctx: CandidateScoreContext,
): number {
  let score = 0;

  // 1. Interest match
  if (
    place.interests &&
    ctx.interests.some((i) => place.interests?.includes(i))
  ) {
    score += 35;
  } else {
    for (const interest of ctx.interests) {
      if (matchesInterest(place, interest)) {
        score += 25;
        break;
      }
    }
  }

  // 2. User notes match
  if (ctx.notes && ctx.notes.trim().length > 2) {
    const text =
      `${place.name} ${place.kind} ${place.cuisine || ""} ${place.highlight || ""}`.toLowerCase();
    const keywords = ctx.notes
      .toLowerCase()
      .split(/[\s,.;]+/)
      .filter((w) => w.length > 3);
    if (keywords.some((k) => text.includes(k))) {
      score += 45;
    }
  }

  // 3. Notability: curated > wikipedia/wikidata > website/opening hours > bare name
  if (place.highlight || place.bestTime) {
    score += 50;
  } else if (place.hasWikipedia || place.hasWikidata) {
    score += 35;
  } else if (place.hasWebsite || place.openingHours) {
    score += 15;
  }

  // 4. Detour / distance penalty
  if (place.routeDistanceKm != null && Number.isFinite(place.routeDistanceKm)) {
    score -= place.routeDistanceKm * 15;
  } else if (place.distanceKm != null && Number.isFinite(place.distanceKm)) {
    score -= place.distanceKm * 2;
  }

  return score;
}

/**
 * Finds the highest-scoring cluster of candidates within maxDistanceKm of each other.
 */
export function findBestCluster(
  candidates: NearbyPlace[],
  ctx: CandidateScoreContext,
  maxDistanceKm = 2.5,
): NearbyPlace[] {
  if (candidates.length <= 1) return [...candidates];

  // Candidates for main cluster should prefer non-restaurant attractions
  const nonFood = candidates.filter(
    (c) =>
      c.category !== "restaurant" &&
      !["restaurant", "cafe", "fast_food"].includes(c.kind) &&
      c.category !== "hotel",
  );
  const poolToCluster =
    nonFood.length >= 2
      ? nonFood
      : candidates.filter((c) => c.category !== "hotel");

  let bestCluster: NearbyPlace[] = [];
  let bestScore = -Infinity;

  for (const center of poolToCluster) {
    const cluster = poolToCluster.filter(
      (c) => distanceKm(center, c) <= maxDistanceKm,
    );
    const clusterScore = cluster.reduce(
      (sum, p) => sum + scoreCandidate(p, ctx),
      0,
    );
    if (clusterScore > bestScore) {
      bestScore = clusterScore;
      bestCluster = cluster;
    }
  }

  return bestCluster.length > 0 ? bestCluster : candidates;
}

/**
 * Build ordered slot definitions according to journey/anchor mode, start time,
 * hours budget, pace, and solar sunset.
 */
export function buildSlotPlan(input: {
  mode: ItineraryMode;
  startTime: string;
  hours: number;
  pace: "relaxed" | "balanced" | "packed";
  date?: string | undefined;
  destinationCoords: Coordinate;
  driveMinutesTotal?: number | undefined;
}): SlotDefinition[] {
  const [sh, sm] = input.startTime.split(":").map(Number);
  const startMin = (sh ?? 9) * 60 + (sm ?? 0);
  const totalBudgetMin = input.hours * 60;
  const endMin = startMin + totalBudgetMin;
  const driveMin = input.driveMinutesTotal ?? 0;
  const availableStopBudget = Math.max(0, totalBudgetMin - driveMin);

  const visitDuration =
    input.pace === "relaxed" ? 75 : input.pace === "balanced" ? 50 : 35;
  const sunset = sunsetMinutes(
    input.date,
    input.destinationCoords.lat,
    input.destinationCoords.lng,
  );

  const slots: SlotDefinition[] = [];
  let currentMin = startMin;

  // 1. En-route stops (journey mode only, detour <= 12 min, only when budget >= 3h)
  if (input.mode === "journey" && availableStopBudget >= 180) {
    const enRouteCount = availableStopBudget >= 300 ? 2 : 1;
    for (let i = 0; i < enRouteCount; i++) {
      slots.push({
        id: `en-route-${i + 1}`,
        slot: "en-route",
        targetTimeMin: currentMin + 30,
        windowStartMin: currentMin,
        windowEndMin: currentMin + 90,
        durationMin: Math.min(visitDuration, 40),
      });
      currentMin += Math.min(visitDuration, 40) + 15;
    }
  }

  // 2. Breakfast check: window 07:30–10:00 (450–600 min), only if plan starts before 09:00 (< 540 min)
  if (startMin < 540 && currentMin <= 570) {
    slots.push({
      id: "meal-breakfast",
      slot: "meal",
      targetTimeMin: Math.max(currentMin, 480),
      windowStartMin: 450,
      windowEndMin: 600,
      durationMin: 40,
    });
    currentMin = Math.max(currentMin, 480) + 40;
  }

  // 3. Destination arrival stop (appears exactly once, slot "arrive")
  slots.push({
    id: "destination-arrive",
    slot: "arrive",
    targetTimeMin: currentMin,
    windowStartMin: startMin,
    windowEndMin: endMin,
    durationMin: visitDuration,
  });
  currentMin += visitDuration + 10;

  // 4. Morning main stops (fill time before lunch)
  const lunchWindowStart = 720; // 12:00
  const hasLunch = startMin < 840 && endMin >= 750;
  const morningCutoff = hasLunch
    ? lunchWindowStart
    : Math.min(endMin, sunset - 60);

  let morningSlotCount = 1;
  while (currentMin + visitDuration <= morningCutoff) {
    slots.push({
      id: `main-morning-${morningSlotCount++}`,
      slot: "main",
      targetTimeMin: currentMin,
      windowStartMin: startMin,
      windowEndMin: morningCutoff,
      durationMin: visitDuration,
    });
    currentMin += visitDuration + 10;
  }

  // 4. Lunch check: window 12:00–14:30 (720–870 min)
  if (hasLunch && currentMin <= 840) {
    const lunchTarget = Math.max(currentMin, 720); // 12:00 or current
    if (lunchTarget <= 840) {
      slots.push({
        id: "meal-lunch",
        slot: "meal",
        targetTimeMin: lunchTarget,
        windowStartMin: 720,
        windowEndMin: 870,
        durationMin: 50,
      });
      currentMin = lunchTarget + 50;
    }
  }

  // 5. Afternoon main stops
  let afternoonSlotCount = 1;
  const afternoonCutoff = Math.min(endMin, sunset - 60);
  while (currentMin + visitDuration <= afternoonCutoff) {
    slots.push({
      id: `main-afternoon-${afternoonSlotCount++}`,
      slot: "main",
      targetTimeMin: currentMin,
      windowStartMin: startMin,
      windowEndMin: Math.min(endMin, sunset - 30),
      durationMin: visitDuration,
    });
    currentMin += visitDuration + 10;
  }

  // 6. Sunset check: arriving ~45–60 min before sunset (beach/viewpoint/fort)
  if (startMin <= sunset && endMin >= sunset - 30) {
    const sunsetTarget = sunset - 50;
    if (sunsetTarget >= startMin && sunsetTarget + 45 <= endMin + 15) {
      slots.push({
        id: "sunset-slot",
        slot: "sunset",
        targetTimeMin: sunsetTarget,
        windowStartMin: sunset - 60,
        windowEndMin: sunset + 20,
        durationMin: Math.max(visitDuration, 45),
      });
      currentMin = sunsetTarget + 50;
    }
  }

  // 7. Dinner check: window 19:00–21:30 (1140–1290 min), only if plan runs that late
  if (endMin >= 1170 && currentMin <= 1260) {
    const dinnerTarget = Math.max(currentMin, 1170); // 19:30 or current
    if (dinnerTarget <= 1260) {
      slots.push({
        id: "meal-dinner",
        slot: "meal",
        targetTimeMin: dinnerTarget,
        windowStartMin: 1140,
        windowEndMin: 1290,
        durationMin: 60,
      });
      currentMin = dinnerTarget + 60;
    }
  }

  // Ensure at least destination arrival slot if no slots were added
  if (slots.length === 0) {
    slots.push({
      id: "destination-arrive",
      slot: "arrive",
      targetTimeMin: startMin,
      windowStartMin: startMin,
      windowEndMin: endMin,
      durationMin: visitDuration,
    });
  }

  return slots;
}

/**
 * Converts raw OSM kind tags to clear, human-readable wording.
 * e.g. "place_of_worship" -> "Temple" or "Church" based on venue name.
 */
export function humanizeKind(place: { name?: string; kind: string }): string {
  const name = (place.name || "").toLowerCase();
  const kind = (place.kind || "").toLowerCase().replace(/_/g, " ").trim();

  if (kind.includes("place of worship") || kind === "religion") {
    if (
      name.includes("church") ||
      name.includes("cathedral") ||
      name.includes("basilica") ||
      name.includes("chapel") ||
      name.includes("se cathedral")
    ) {
      return "Church";
    }
    if (
      name.includes("temple") ||
      name.includes("mandir") ||
      name.includes("devasthan") ||
      name.includes("shri") ||
      name.includes("sansthan") ||
      name.includes("math")
    ) {
      return "Temple";
    }
    if (name.includes("mosque") || name.includes("masjid")) {
      return "Mosque";
    }
    if (name.includes("gurdwara")) {
      return "Gurdwara";
    }
    return "Temple";
  }
  if (kind === "viewpoint") return "Viewpoint";
  if (kind === "attraction") return "Attraction";
  if (kind === "historic" || kind === "monument") return "Historic monument";
  if (kind === "archaeological site") return "Archaeological site";
  if (kind === "ruins") return "Historic ruins";
  if (kind === "fast food") return "Quick bites";
  if (kind === "food court") return "Food court";
  if (kind === "water park") return "Water park";
  if (kind === "nature reserve") return "Nature reserve";
  if (kind === "beach") return "Beach";
  if (kind === "fort") return "Fort";
  if (kind === "museum") return "Museum";
  if (kind === "restaurant") return "Restaurant";
  if (kind === "cafe") return "Café";
  if (kind === "bar" || kind === "pub") return "Bar";

  return kind
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Converts raw OSM cuisine tags to human-friendly cuisine text.
 * e.g. "goan;seafood;curry" -> "Goan seafood".
 */
export function humanizeCuisine(raw?: string): string {
  if (!raw) return "Local dining";
  const parts = raw
    .split(/[;,]+/)
    .map((s) => s.trim().replace(/_/g, " ").toLowerCase())
    .filter(Boolean);
  if (!parts.length) return "Local dining";

  // Filter out redundant/generic sub-tags
  const filtered = parts.filter(
    (p) =>
      !(
        p === "curry" &&
        (parts.includes("goan") ||
          parts.includes("indian") ||
          parts.includes("seafood"))
      ),
  );
  const terms = filtered.length > 0 ? filtered.slice(0, 2) : parts.slice(0, 1);

  const formatWord = (w: string) => {
    if (w.toLowerCase() === "cafe") return "Café";
    return w.charAt(0).toUpperCase() + w.slice(1);
  };
  const formatTerm = (t: string) => t.split(" ").map(formatWord).join(" ");

  if (terms.length === 1) {
    return formatTerm(terms[0]!);
  }
  if (terms[0] === "goan" && (terms[1] === "seafood" || terms[1] === "fish")) {
    return "Goan seafood";
  }
  return `${formatTerm(terms[0]!)} & ${formatTerm(terms[1]!)}`;
}

/**
 * Sanitizes any raw OSM tags or remnants in "Why this stop" descriptions.
 */
export function cleanWhy(why: string): string {
  if (!why) return "";
  let text = why;
  text = text.replace(/\bplace_of_worship\b/gi, "Temple");
  text = text.replace(/\bfast_food\b/gi, "quick bites");
  text = text.replace(/goan;seafood;curry/gi, "Goan seafood");
  text = text.replace(/\b([a-z]+);([a-z]+)(;[a-z]+)*\b/gi, (match) =>
    humanizeCuisine(match),
  );
  text = text.replace(
    /destination cluster highlight/gi,
    "in the main sightseeing cluster",
  );
  text = text.replace(/_/g, " ");
  return text;
}

/**
 * Pure itinerary engine planner.
 * Assembles slot-based plan with opening hours checking, cluster cohesion,
 * meal separation, and detour constraints.
 */
export function planDay(input: PlanDayInput): PlanDayResult {
  const [sh, sm] = input.startTime.split(":").map(Number);
  const startMinute = (sh ?? 9) * 60 + (sm ?? 0);
  const totalBudgetMinutes = input.hours * 60;
  const deadlineMinute = startMinute + totalBudgetMinutes;

  const ctx: CandidateScoreContext = {
    interests: input.interests,
    notes: input.notes,
    center: input.destination,
  };

  const buffer =
    input.pace === "relaxed" ? 15 : input.pace === "balanced" ? 10 : 5;
  const defaultDuration =
    input.pace === "relaxed" ? 75 : input.pace === "balanced" ? 50 : 35;

  const usedIds = new Set<string>(input.excludeIds ?? []);

  // Filter destination candidates into best cluster (within 2.5 km of each other)
  const clusterPool = findBestCluster(
    input.destinationCandidates.filter((c) => !usedIds.has(c.id)),
    ctx,
    2.5,
  );

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

  // Stage 4: Candidates after open/closed filtering
  const allPoolCandidates = [
    ...input.destinationCandidates,
    ...(input.corridorCandidates || []),
  ];
  const openCandidates = allPoolCandidates.filter((p) => {
    return (
      isOpenAt(p.openingHours, input.date, startMinute + 30) !== "closed" ||
      isOpenAt(p.openingHours, input.date, startMinute + 120) !== "closed" ||
      isOpenAt(p.openingHours, input.date, startMinute + 240) !== "closed"
    );
  });
  const stage4 = countSources(openCandidates);
  if (process.env["ITINERARY_DEBUG"] === "1") {
    console.log(
      `[itinerary] Stage 4 (after open/closed filtering): total=${stage4.total} (catalogue: ${stage4.catalogue}, curated: ${stage4.curated}, OSM: ${stage4.osm})`,
    );
  }

  // Stage 5: Candidates after cluster selection
  const stage5 = countSources(clusterPool);
  if (process.env["ITINERARY_DEBUG"] === "1") {
    console.log(
      `[itinerary] Stage 5 (after cluster selection): total=${stage5.total} (catalogue: ${stage5.catalogue}, curated: ${stage5.curated}, OSM: ${stage5.osm})`,
    );
  }

  const slots = buildSlotPlan({
    mode: input.mode,
    startTime: input.startTime,
    hours: input.hours,
    pace: input.pace,
    date: input.date,
    destinationCoords: input.destination,
    driveMinutesTotal: input.driveMinutesTotal,
  });

  const stops: PlanStop[] = [];
  let clock = startMinute;
  let previousCoords: Coordinate = input.start || input.destination;

  for (const slotDef of slots) {
    if (clock + 20 > deadlineMinute) break;

    // Pick candidate pool for this slot
    let pool: NearbyPlace[] = [];
    if (slotDef.slot === "arrive") {
      const destName = (input.destination.name || "").toLowerCase().trim();
      const destCandidate = input.destinationCandidates.find((c) => {
        if (
          c.category === "restaurant" ||
          [
            "restaurant",
            "cafe",
            "fast_food",
            "food_court",
            "bar",
            "pub",
          ].includes(c.kind)
        ) {
          return false;
        }
        const cName = c.name.toLowerCase().trim();
        if (
          destName &&
          (cName === destName ||
            cName.includes(destName) ||
            destName.includes(cName))
        ) {
          return true;
        }
        return distanceKm(c, input.destination) < 0.3;
      });
      pool = destCandidate
        ? [destCandidate]
        : [
            {
              id: `destination/${encodeURIComponent(destName || "anchor")}`,
              name: input.destination.name || "Destination",
              lat: input.destination.lat,
              lng: input.destination.lng,
              category: "attraction" as const,
              kind: "attraction",
              distanceKm: 0,
              sourceUrl: "https://www.openstreetmap.org",
              source: "curated" as const,
            },
          ];
    } else if (slotDef.slot === "en-route") {
      pool = (input.corridorCandidates || []).filter(
        (p) =>
          !usedIds.has(p.id) &&
          p.category !== "hotel" &&
          p.category !== "restaurant" &&
          !["restaurant", "cafe", "fast_food"].includes(p.kind) &&
          (p.routeDistanceKm == null || p.routeDistanceKm <= 1.5) &&
          distanceKm(p, input.destination) >= 3.0,
      );
    } else if (slotDef.slot === "meal") {
      // Meal candidates: strictly restaurant/cafe, prefer within ~2 km of previousCoords
      // Never two meals back to back:
      const lastStop = stops[stops.length - 1];
      if (lastStop?.type !== "food") {
        pool = input.destinationCandidates.filter(
          (p) =>
            !usedIds.has(p.id) &&
            isLikelyDining(p) &&
            ((input.interests || []).includes("Nightlife") ||
              !isNightlifeVenue(p)) &&
            (p.category === "restaurant" ||
              ["restaurant", "cafe", "fast_food"].includes(p.kind)),
        );
      }
    } else if (slotDef.slot === "sunset") {
      // Sunset candidates: beach, viewpoint, fort, or bestTime === "sunset" (strictly non-food)
      pool = input.destinationCandidates.filter(
        (p) =>
          !usedIds.has(p.id) &&
          p.category !== "hotel" &&
          p.category !== "restaurant" &&
          !["restaurant", "cafe", "fast_food"].includes(p.kind) &&
          (p.bestTime === "sunset" ||
            ["beach", "viewpoint", "fort", "lighthouse"].includes(p.kind) ||
            p.name.toLowerCase().includes("beach") ||
            p.name.toLowerCase().includes("sunset")),
      );
      if (pool.length === 0) {
        pool = clusterPool.filter(
          (p) =>
            !usedIds.has(p.id) &&
            p.category !== "hotel" &&
            p.category !== "restaurant" &&
            !["restaurant", "cafe", "fast_food"].includes(p.kind),
        );
      }
      if (pool.length === 0) {
        pool = input.destinationCandidates.filter(
          (p) =>
            !usedIds.has(p.id) &&
            p.category !== "hotel" &&
            p.category !== "restaurant" &&
            !["restaurant", "cafe", "fast_food"].includes(p.kind),
        );
      }
    } else {
      // Main destination cluster (strictly non-food)
      const existingMainStops = stops.filter(
        (s) => s.slot === "main" && s.lat != null && s.lng != null,
      );
      const isWithinRadius = (p: NearbyPlace, maxKm: number) =>
        existingMainStops.length === 0 ||
        existingMainStops.every(
          (s) => distanceKm({ lat: s.lat!, lng: s.lng! }, p) <= maxKm,
        );

      const isSchedulableNonFood = (p: NearbyPlace) =>
        !usedIds.has(p.id) &&
        p.category !== "hotel" &&
        p.category !== "restaurant" &&
        !["restaurant", "cafe", "fast_food", "food_court"].includes(p.kind);

      // Try radius 2.5 km first: clusterPool, then destinationCandidates
      let mainCandidates = clusterPool.filter(
        (p) => isSchedulableNonFood(p) && isWithinRadius(p, 2.5),
      );
      if (mainCandidates.length === 0) {
        mainCandidates = input.destinationCandidates.filter(
          (p) => isSchedulableNonFood(p) && isWithinRadius(p, 2.5),
        );
      }

      // If no candidate qualifies, retry with 5 km: clusterPool first, then all destination candidates
      if (mainCandidates.length === 0) {
        mainCandidates = clusterPool.filter(
          (p) => isSchedulableNonFood(p) && isWithinRadius(p, 5.0),
        );
        if (mainCandidates.length === 0) {
          mainCandidates = input.destinationCandidates.filter(
            (p) => isSchedulableNonFood(p) && isWithinRadius(p, 5.0),
          );
        }
      }

      pool = mainCandidates;
    }

    if (slotDef.slot !== "arrive" && slotDef.slot !== "meal") {
      const allowNightlife =
        (input.interests || []).includes("Nightlife") &&
        slotDef.windowStartMin >= 19 * 60;
      if (!allowNightlife) {
        pool = pool.filter((p) => !isNightlifeVenue(p));
      }
    }

    if (pool.length === 0) continue;

    // Estimate transit and arrival time
    // Sort pool by suitability score
    let scored = pool
      .map((place) => {
        let distKm = distanceKm(previousCoords, place);
        let transitMin = Math.max(3, Math.ceil(distKm * 2.5)) + buffer;

        if (input.durations && input.candidateList) {
          const prevIdx =
            stops.length === 0
              ? 0
              : input.candidateList.findIndex(
                  (c) =>
                    c.id === stops[stops.length - 1]?.id ||
                    c.name === stops[stops.length - 1]?.title,
                ) + 1;
          const currIdx =
            input.candidateList.findIndex((c) => c.id === place.id) + 1;
          if (currIdx > 0 && input.durations[prevIdx]?.[currIdx] != null) {
            const sec = input.durations[prevIdx]![currIdx]!;
            const meters = input.distances?.[prevIdx]?.[currIdx];
            const drive = Math.ceil(sec / 60);
            transitMin = drive + buffer;
            if (meters != null) distKm = Math.round((meters / 1000) * 10) / 10;
          }
        }

        let arrivalMin = Math.max(clock + transitMin, slotDef.windowStartMin);
        let openStatus = isOpenAt(place.openingHours, input.date, arrivalMin);

        // If closed at exact arrival minute, check if venue opens slightly later within the slot window
        if (openStatus === "closed" && place.openingHours) {
          const maxWait = 45;
          const checkLimit = Math.min(
            arrivalMin + maxWait,
            slotDef.windowEndMin,
            deadlineMinute - 20,
          );
          for (let t = arrivalMin + 5; t <= checkLimit; t += 5) {
            if (isOpenAt(place.openingHours, input.date, t) === "open") {
              arrivalMin = t;
              openStatus = "open";
              break;
            }
          }
        }

        // Detour in minutes for en-route
        const detourMin =
          place.routeDistanceKm != null
            ? Math.round((place.routeDistanceKm / 35) * 60 * 2)
            : 0;

        let score = scoreCandidate(place, ctx);
        if (slotDef.slot === "sunset" && place.bestTime === "sunset") {
          score += 30;
        }
        if (slotDef.slot === "meal" && distKm <= 2.5) {
          score += 20;
        }

        return {
          place,
          distKm,
          transitMin,
          arrivalMin,
          openStatus,
          detourMin,
          score,
        };
      })
      // Exclude candidates whose opening hours are explicitly "closed" at arrival
      .filter((c) => c.openStatus !== "closed")
      // Detour limit <= 12 min for en-route
      .filter((c) => (slotDef.slot === "en-route" ? c.detourMin <= 12 : true))
      .sort((a, b) => b.score - a.score || a.distKm - b.distKm);

    if (slotDef.slot === "meal") {
      const near = scored.filter((c) => c.distKm <= 4.0);
      if (near.length > 0) {
        scored = near;
      }
    }

    if (scored.length === 0) continue;

    const selected = input.slotSelections?.[slotDef.id];
    const matchSelected = selected
      ? scored.find((c) => c.place.id === selected.placeId)
      : undefined;

    // Try AI pick first, then remaining candidates in scored order
    const candidatesToTry = matchSelected
      ? [matchSelected, ...scored.filter((c) => c !== matchSelected)]
      : scored;

    let chosen: (typeof scored)[0] | undefined;
    let chosenDurationMin = 0;
    let chosenDepartureMin = 0;

    for (const cand of candidatesToTry) {
      // Calculate return drive if returning to start
      let returnMin = 0;
      if (input.returnToStart) {
        if (input.durations && input.candidateList) {
          const candIdx =
            input.candidateList.findIndex((c) => c.id === cand.place.id) + 1;
          if (candIdx > 0 && input.durations[candIdx]?.[0] != null) {
            returnMin = Math.ceil(input.durations[candIdx]![0]! / 60) + buffer;
          }
        }
        if (returnMin === 0) {
          const returnDist = distanceKm(
            cand.place,
            input.start || input.destination,
          );
          returnMin = Math.max(5, Math.ceil(returnDist * 2.5)) + buffer;
        }
      }

      const available = deadlineMinute - returnMin - cand.arrivalMin;
      let dur = slotDef.durationMin || defaultDuration;
      if (stops.length === 0) {
        dur = Math.min(dur, available);
      }
      const minDur = cand.place.category === "restaurant" ? 30 : 20;
      if (dur < minDur) continue;

      const dep = cand.arrivalMin + dur;
      if (dep + returnMin > deadlineMinute) continue;

      chosen = cand;
      chosenDurationMin = dur;
      chosenDepartureMin = dep;
      break;
    }

    if (!chosen) continue;

    const durationMin = chosenDurationMin;
    const departureMin = chosenDepartureMin;

    const stopType =
      chosen.place.category === "restaurant" ||
      ["restaurant", "cafe", "fast_food"].includes(chosen.place.kind)
        ? "food"
        : chosen.place.kind === "beach"
          ? "beach"
          : "sight";

    stops.push({
      id: chosen.place.id,
      time: formatPlanTime(chosen.arrivalMin),
      title: chosen.place.name,
      type: stopType,
      duration: `${durationMin} min`,
      durationMin,
      arrivalMinute: chosen.arrivalMin,
      departureMinute: departureMin,
      description:
        chosen.place.highlight ||
        `${chosen.place.kind} in ${input.destination.name || "Goa"}.`,
      travel_note:
        chosen.transitMin > 0
          ? `${Math.round(chosen.distKm * 10) / 10} km drive (~${chosen.transitMin - buffer} min)`
          : "Nearby arrival",
      lat: chosen.place.lat,
      lng: chosen.place.lng,
      distanceKm: Math.round(chosen.distKm * 10) / 10,
      transitMin: chosen.transitMin,
      sourceUrl: chosen.place.sourceUrl,
      slot: slotDef.slot,
      why:
        matchSelected?.place.id === selected?.placeId && selected?.why
          ? cleanWhy(selected.why.slice(0, 160))
          : slotDef.slot === "arrive"
            ? `${humanizeKind(chosen.place)} · destination highlight`
            : slotDef.slot === "en-route"
              ? `${humanizeKind(chosen.place)} · ${chosen.detourMin} min detour from route`
              : slotDef.slot === "sunset"
                ? `${humanizeKind(chosen.place)} · ideal for sunset before dark`
                : slotDef.slot === "meal"
                  ? `${humanizeCuisine(chosen.place.cuisine)} · ${slotDef.id.includes("lunch") ? "lunchtime stop" : slotDef.id.includes("breakfast") ? "breakfast stop" : "nearby meal stop"}`
                  : `${humanizeKind(chosen.place)} · in the main sightseeing cluster`,
      openStatus: chosen.openStatus === "unknown" ? "unknown" : "open",
      detourMin: chosen.detourMin,
      source:
        chosen.place.source ||
        (chosen.place.id.startsWith("curated/") ? "curated" : "catalogue"),
      kind: chosen.place.kind,
    });

    usedIds.add(chosen.place.id);
    clock = departureMin;
    previousCoords = chosen.place;
  }

  const returnDistKm = input.returnToStart
    ? distanceKm(previousCoords, input.start || input.destination)
    : 0;
  const returnMinutes = input.returnToStart
    ? Math.max(5, Math.ceil(returnDistKm * 2.5)) + buffer
    : 0;

  const totalMinutes = clock - startMinute + returnMinutes;
  const unusedMinutes = Math.max(0, totalBudgetMinutes - totalMinutes);

  return {
    stops,
    totalMinutes,
    unusedMinutes,
    returnMinutes,
    budgetMinutes: totalBudgetMinutes,
    endTime: formatPlanTime(startMinute + totalMinutes),
  };
}
