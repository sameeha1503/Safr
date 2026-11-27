export const SHARP_BEND_DEG = 60,
  SHARP_BEND_WINDOW_M = 50,
  HAIRPIN_DEG = 120,
  HAIRPIN_WINDOW_M = 100,
  JUNCTION_EXCLUDE_RADIUS_M = 35,
  MIN_POINT_SPACING_M = 5;

export type RouteCharacter = {
  sharpBends: number; // 60-119 degree bends on continuous road
  hairpins: number; // >=120 degree bends
  bendsPer10Km: number; // (sharpBends + hairpins) / (km / 10), rounded to 1 decimal
  junctionsPerKm: number; // rounded to 1 decimal
  ghatKm: number; // km of steps whose road name contains "ghat" (case-insensitive), rounded to 1 decimal
  ghatNames: string[]; // distinct matching names
  accidentZones: number; // route.hazardZones.length
  mainRoadKm: number | null; // info only; null when unavailable
};

export type Point = { lat: number; lng: number };

export type StepLike = {
  name?: string | undefined;
  distanceMeters?: number | undefined;
  maneuverType?: string | undefined;
  location?: [number, number] | { lat: number; lng: number } | undefined;
};

export function haversineDistanceMeters(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlng = Math.sin(dLng / 2);
  const x =
    sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlng * sinDlng;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}

export function initialBearing(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const dLng = (b.lng - a.lng) * rad;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function normalizeHeadingDiff(diff: number): number {
  let angle = ((diff % 360) + 360) % 360;
  if (angle > 180) {
    angle -= 360;
  }
  return angle;
}

export function getStepPoint(step: StepLike): Point | null {
  if (!step.location) return null;
  if (Array.isArray(step.location)) {
    const lat = step.location[0];
    const lng = step.location[1];
    if (typeof lat === "number" && typeof lng === "number") {
      return { lat, lng };
    }
    return null;
  }
  if (typeof step.location === "object") {
    const lat = step.location.lat;
    const lng = step.location.lng;
    if (typeof lat === "number" && typeof lng === "number") {
      return { lat, lng };
    }
  }
  return null;
}

const NON_JUNCTION_MANEUVERS = new Set([
  "continue",
  "new name",
  "depart",
  "arrive",
]);

export const JUNCTION_MANEUVERS = new Set([
  "turn",
  "fork",
  "merge",
  "end of road",
  "roundabout",
  "rotary",
  "on ramp",
  "off ramp",
]);

export function computeBends(
  points: Array<Point | [number, number]>,
  steps: StepLike[],
): { sharpBends: number; hairpins: number } {
  const junctionStepLocations: Point[] = [];
  for (const step of steps) {
    const mType = (step.maneuverType ?? "").toLowerCase().trim();
    if (!NON_JUNCTION_MANEUVERS.has(mType)) {
      const loc = getStepPoint(step);
      if (loc) {
        junctionStepLocations.push(loc);
      }
    }
  }

  function isNearJunctionStep(pt: Point): boolean {
    for (const jPt of junctionStepLocations) {
      if (haversineDistanceMeters(pt, jPt) <= JUNCTION_EXCLUDE_RADIUS_M) {
        return true;
      }
    }
    return false;
  }

  const kept: Point[] = [];
  for (const rawPt of points) {
    const pt: Point = Array.isArray(rawPt)
      ? { lat: rawPt[0], lng: rawPt[1] }
      : rawPt;
    if (kept.length === 0) {
      kept.push(pt);
    } else {
      const prev = kept[kept.length - 1]!;
      if (haversineDistanceMeters(prev, pt) >= MIN_POINT_SPACING_M) {
        kept.push(pt);
      }
    }
  }

  if (kept.length < 3) {
    return { sharpBends: 0, hairpins: 0 };
  }

  const cumDist = new Float64Array(kept.length);
  cumDist[0] = 0;
  for (let i = 1; i < kept.length; i++) {
    cumDist[i] =
      cumDist[i - 1]! + haversineDistanceMeters(kept[i - 1]!, kept[i]!);
  }

  const headings = new Float64Array(kept.length - 1);
  for (let i = 0; i < kept.length - 1; i++) {
    headings[i] = initialBearing(kept[i]!, kept[i + 1]!);
  }

  const turnAngles = new Float64Array(kept.length);
  for (let i = 1; i < kept.length - 1; i++) {
    turnAngles[i] = normalizeHeadingDiff(headings[i]! - headings[i - 1]!);
  }

  let sharpBends = 0;
  let hairpins = 0;
  let i = 1;

  while (i < kept.length - 1) {
    if (isNearJunctionStep(kept[i]!)) {
      i++;
      continue;
    }

    // Check hairpin window first
    let hairpinAccum = 0;
    let hairpinFound = false;
    let hairpinNearJunction = false;

    for (let j = i; j < kept.length - 1; j++) {
      if (cumDist[j]! - cumDist[i]! > HAIRPIN_WINDOW_M) break;
      if (isNearJunctionStep(kept[j]!)) {
        hairpinNearJunction = true;
        break;
      }
      hairpinAccum += turnAngles[j]!;
      if (Math.abs(hairpinAccum) >= HAIRPIN_DEG) {
        hairpinFound = true;
        break;
      }
    }

    if (hairpinFound && !hairpinNearJunction) {
      hairpins++;
      const targetDist = cumDist[i]! + HAIRPIN_WINDOW_M;
      while (i < kept.length - 1 && cumDist[i]! <= targetDist) {
        i++;
      }
      continue;
    }

    // Check sharp bend window
    let sharpAccum = 0;
    let sharpFound = false;
    let sharpNearJunction = false;

    for (let j = i; j < kept.length - 1; j++) {
      if (cumDist[j]! - cumDist[i]! > SHARP_BEND_WINDOW_M) break;
      if (isNearJunctionStep(kept[j]!)) {
        sharpNearJunction = true;
        break;
      }
      sharpAccum += turnAngles[j]!;
      if (Math.abs(sharpAccum) >= SHARP_BEND_DEG) {
        sharpFound = true;
        break;
      }
    }

    if (sharpFound && !sharpNearJunction) {
      sharpBends++;
      const targetDist = cumDist[i]! + SHARP_BEND_WINDOW_M;
      while (i < kept.length - 1 && cumDist[i]! <= targetDist) {
        i++;
      }
      continue;
    }

    i++;
  }

  return { sharpBends, hairpins };
}

export function computeRouteCharacter({
  points,
  steps,
  routeDistanceMeters,
  hazardZones,
  mainRoadKm = null,
}: {
  points: Array<Point | [number, number]>;
  steps: StepLike[];
  routeDistanceMeters: number;
  hazardZones: unknown[];
  mainRoadKm?: number | null | undefined;
}): RouteCharacter {
  const { sharpBends, hairpins } = computeBends(points, steps);

  const routeKm = routeDistanceMeters / 1000;
  const bendsPer10Km =
    routeKm > 0
      ? Math.round(((sharpBends + hairpins) / (routeKm / 10)) * 10) / 10
      : 0;

  let junctionCount = 0;
  let ghatMeters = 0;
  const ghatNamesSet = new Set<string>();

  for (const step of steps) {
    const mType = (step.maneuverType ?? "").toLowerCase().trim();
    if (JUNCTION_MANEUVERS.has(mType)) {
      junctionCount++;
    }

    if (step.name && /ghat/i.test(step.name)) {
      ghatMeters += step.distanceMeters ?? 0;
      const trimmed = step.name.trim();
      if (trimmed.length > 0) {
        ghatNamesSet.add(trimmed);
      }
    }
  }

  const junctionsPerKm =
    routeKm > 0 ? Math.round((junctionCount / routeKm) * 10) / 10 : 0;
  const ghatKm = Math.round((ghatMeters / 1000) * 10) / 10;
  const ghatNames = Array.from(ghatNamesSet);

  return {
    sharpBends,
    hairpins,
    bendsPer10Km,
    junctionsPerKm,
    ghatKm,
    ghatNames,
    accidentZones: Array.isArray(hazardZones) ? hazardZones.length : 0,
    mainRoadKm: mainRoadKm ?? null,
  };
}

export function computeFewerRiskIndicators(
  routes: Array<{ character: RouteCharacter }>,
  hazardDataAvailable: boolean,
): boolean[] {
  if (!hazardDataAvailable || routes.length < 2) {
    return routes.map(() => false);
  }

  return routes.map((r, i) => {
    for (let j = 0; j < routes.length; j++) {
      if (i === j) continue;
      const other = routes[j]!;
      const rc = r.character;
      const oc = other.character;

      const leAllThree =
        rc.bendsPer10Km <= oc.bendsPer10Km &&
        rc.junctionsPerKm <= oc.junctionsPerKm &&
        rc.accidentZones <= oc.accidentZones;

      const ltAtLeastOne =
        rc.bendsPer10Km < oc.bendsPer10Km ||
        rc.junctionsPerKm < oc.junctionsPerKm ||
        rc.accidentZones < oc.accidentZones;

      if (!leAllThree || !ltAtLeastOne) {
        return false;
      }
    }
    return true;
  });
}
