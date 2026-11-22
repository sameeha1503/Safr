import type { Coordinate } from "./geo";
export type RoadWay = {
  id?: number | undefined;
  nodes: number[];
  tags: Record<string, string>;
};
export type RoadLeg = {
  annotation?:
    | {
        nodes?: number[] | undefined;
        wayIds?: number[] | undefined;
        distance: number[];
      }
    | undefined;
};
export type SafetyEvidence = {
  coveragePercent: number;
  conditionCoveragePercent: number;
  lightingCoveragePercent: number;
  mappedRiskExposure: number | null;
  sufficient: boolean;
  reasons: string[];
};

export function assessRoadConditions(
  legs: RoadLeg[],
  ways: RoadWay[],
  isNight: boolean,
): SafetyEvidence {
  const edges = new Map<string, Record<string, string>[]>();
  const wayMap = new Map<number, Record<string, string>>();
  const pair = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  for (const way of ways) {
    if (typeof way.id === "number") {
      wayMap.set(way.id, way.tags);
    }
    for (let i = 1; i < way.nodes.length; i++) {
      const key = pair(way.nodes[i - 1]!, way.nodes[i]!);
      edges.set(key, [...(edges.get(key) || []), way.tags]);
    }
  }
  let total = 0,
    mapped = 0,
    known = 0,
    lighting = 0,
    basePenalty = 0,
    unpaved = 0,
    rough = 0,
    unlit = 0,
    highSpeed = 0,
    standardRoads = 0,
    minorRoads = 0;
  for (const leg of legs) {
    const a = leg.annotation;
    if (!a) continue;
    const hasWayIds =
      Array.isArray(a.wayIds) && a.wayIds.length === a.distance.length;
    const hasNodes =
      Array.isArray(a.nodes) && a.nodes.length === a.distance.length + 1;
    if (!hasWayIds && !hasNodes) continue;

    for (let i = 0; i < a.distance.length; i++) {
      const meters = a.distance[i]!;
      total += meters;
      let tags: Record<string, string> | undefined;
      if (hasWayIds) {
        const wayId = a.wayIds![i]!;
        tags = wayMap.get(wayId);
      } else {
        const matches = edges.get(pair(a.nodes![i]!, a.nodes![i + 1]!));
        // Ambiguous segments remain unknown instead of borrowing a neighbouring road's tags.
        if (matches && matches.length === 1) {
          tags = matches[0]!;
        }
      }
      if (!tags) continue;
      mapped += meters;
      const surface = tags["surface"] || "",
        smoothness = tags["smoothness"] || "",
        lit = tags["lit"] || "",
        highway = tags["highway"] || "";
      const speedTag = tags["maxspeed"] || "";
      const speed = /^\d+(?:\.\d+)?(?: mph)?$/.test(speedTag)
        ? parseFloat(speedTag) * (speedTag.endsWith("mph") ? 1.609344 : 1)
        : null;
      const hasCondition =
        /^(asphalt|concrete|paved|paving_stones|unpaved|gravel|dirt|ground|sand|mud|cobblestone|compacted|fine_gravel)$/.test(
          surface,
        ) ||
        /^(excellent|good|intermediate|bad|very_bad|horrible|very_horrible|impassable)$/.test(
          smoothness,
        ) ||
        speed != null;
      if (hasCondition) known += meters;
      if (lit === "yes" || lit === "no") lighting += meters;
      if (/^(unpaved|gravel|dirt|ground|sand|mud|cobblestone)$/.test(surface)) {
        unpaved += meters;
        basePenalty += meters * 3;
      }
      if (
        /^(bad|very_bad|horrible|very_horrible|impassable)$/.test(smoothness)
      ) {
        rough += meters;
        basePenalty += meters * 4;
      }
      if (speed != null && speed >= 80) {
        highSpeed += meters;
        basePenalty += meters;
      }
      if (lit === "no") {
        unlit += meters;
      }

      // Clearly separated road-class component
      if (
        /^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|living_street)$/.test(
          highway,
        )
      ) {
        standardRoads += meters;
        basePenalty += meters * 0.5;
      } else if (
        /^(unclassified|track|path|service|pedestrian|footway)$/.test(highway)
      ) {
        minorRoads += meters;
        basePenalty += meters * 2.5;
      }
    }
  }

  const percent = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const completeAnnotations =
    legs.length > 0 &&
    legs.every((leg) => {
      const a = leg.annotation;
      if (!a) return false;
      const hasWayIds =
        Array.isArray(a.wayIds) && a.wayIds.length === a.distance.length;
      const hasNodes =
        Array.isArray(a.nodes) && a.nodes.length === a.distance.length + 1;
      return Boolean(hasWayIds || hasNodes);
    });

  // Lighting coverage is required >= 70% only for the night lighting part of the estimate
  const hasLightingCoverage = total > 0 && lighting / total >= 0.7;
  let penalty = basePenalty;
  if (isNight && hasLightingCoverage) {
    penalty += unlit * 3;
  }

  const sufficient =
    completeAnnotations &&
    total > 0 &&
    mapped / total >= 0.9 &&
    known / total >= 0.7;

  const reasons: string[] = [
    `Road segment matching: ${percent(mapped)}%; usable condition tags: ${percent(known)}%${isNight ? `; lighting tags: ${percent(lighting)}%` : ""}.`,
    `Mapped exposure: ${(unpaved / 1000).toFixed(1)} km rough/unpaved surface, ${(rough / 1000).toFixed(1)} km poor smoothness, ${(highSpeed / 1000).toFixed(1)} km posted speed ≥80 km/h, ${(minorRoads / 1000).toFixed(1)} km minor/unclassified roads${isNight && hasLightingCoverage ? `, ${(unlit / 1000).toFixed(1)} km unlit` : ""}. Missing tags are unknown, not safe.`,
  ];

  if (isNight && !hasLightingCoverage) {
    reasons.push(
      "Lighting data is incomplete, so night-time lighting was not counted.",
    );
  }

  reasons.push(
    sufficient
      ? "Safety preference estimates mapped surface, smoothness, road class, posted speeds and night lighting. It does not measure crashes, crime, traffic or current hazards."
      : "Insufficient mapped conditions to identify a safest route. No safety score is assigned.",
  );

  return {
    coveragePercent: percent(mapped),
    conditionCoveragePercent: percent(known),
    lightingCoveragePercent: percent(lighting),
    sufficient,
    mappedRiskExposure: sufficient ? penalty / 1000 : null,
    reasons,
  };
}

export function routePreferences<
  T extends {
    distanceMeters: number;
    durationSeconds: number;
    safety: SafetyEvidence;
  },
>(routes: T[]) {
  if (!routes.length) return { fastest: -1, shortest: -1, safest: -1 };
  const indexes = routes.map((_, i) => i);
  const fastest = indexes.reduce((a, b) =>
    routes[b]!.durationSeconds < routes[a]!.durationSeconds ? b : a,
  );
  const shortest = indexes.reduce((a, b) =>
    routes[b]!.distanceMeters < routes[a]!.distanceMeters ? b : a,
  );
  // A safety winner requires multiple comparable candidates and a strictly better result.
  let safest = -1;
  if (routes.length > 1 && routes.every((r) => r.safety.sufficient)) {
    const ordered = [...indexes].sort(
      (a, b) =>
        routes[a]!.safety.mappedRiskExposure! -
        routes[b]!.safety.mappedRiskExposure!,
    );
    if (
      routes[ordered[0]!]!.safety.mappedRiskExposure! <
      routes[ordered[1]!]!.safety.mappedRiskExposure!
    )
      safest = ordered[0]!;
  }
  return { fastest, shortest, safest };
}

export function roadBounds(points: Coordinate[]) {
  return `${Math.min(...points.map((p) => p.lat)) - 0.002},${Math.min(...points.map((p) => p.lng)) - 0.002},${Math.max(...points.map((p) => p.lat)) + 0.002},${Math.max(...points.map((p) => p.lng)) + 0.002}`;
}
