import type { SafetyEvidence } from "./route-comparison";

/** The subset of a scored route this explainer needs (keeps it testable and server-free). */
export type ExplainableRoute = {
  durationMin: number;
  distanceKm: number;
  isFastest: boolean;
  isSafest: boolean;
  safety: SafetyEvidence;
  hazardZones: { id: string; label: string }[];
};

export type RouteChoice = {
  /**
   * safer-alternative: a different route beats the fastest on mapped safety.
   * fastest-is-safest: the quickest route is also the best on mapped safety.
   * unclear: we can't responsibly pick one (not enough data, or no real difference).
   */
  verdict: "safer-alternative" | "fastest-is-safest" | "unclear";
  headline: string;
  /** Plain-language reasons. For "unclear", this explains why we aren't picking one. */
  reasons: string[];
  /** Hazard zones the recommended route still passes through. */
  hazardsOnRecommended: string[];
  fastest: ExplainableRoute | null;
  safer: ExplainableRoute | null;
  /** Extra minutes / km the safer route costs compared to the fastest (can be 0). */
  extraMinutes: number;
  extraKm: number;
};

// Ignore differences smaller than this so we don't claim a benefit from noise.
const MIN_KM_DIFFERENCE = 0.3;

function km(n: number): string {
  return `${n.toFixed(1)} km`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function explainRouteChoice(
  routes: ExplainableRoute[],
  { isNight }: { isNight: boolean },
): RouteChoice {
  const fastest = routes.find((r) => r.isFastest) ?? routes[0] ?? null;
  const safer = routes.find((r) => r.isSafest) ?? null;

  const empty: RouteChoice = {
    verdict: "unclear",
    headline: "",
    reasons: [],
    hazardsOnRecommended: [],
    fastest,
    safer,
    extraMinutes: 0,
    extraKm: 0,
  };

  if (!fastest) return empty;

  // --- No safety winner: explain honestly why not. ---------------------------------
  if (!safer) {
    const reasons: string[] = [];
    if (routes.length < 2) {
      reasons.push(
        "Only one road route was found, so there is nothing to compare it against.",
      );
    } else if (routes.some((r) => !r.safety.sufficient)) {
      const coverage = Math.min(
        ...routes.map((r) => r.safety.conditionCoveragePercent),
      );
      reasons.push(
        `OpenStreetMap has road-condition tags for only ${Math.round(coverage)}% of the lowest-covered route, which isn't enough to say one is safer. Missing tags mean "unknown", not "safe".`,
      );
    } else {
      reasons.push(
        "The routes score the same on surface, road type, speed limits and lighting, so none is clearly safer.",
      );
    }
    if (fastest.hazardZones.length > 0) {
      reasons.push(
        `The fastest route passes ${fastest.hazardZones.map((z) => z.label).join(", ")}, a known accident-prone ${plural(fastest.hazardZones.length, "spot", "spots")}. Take extra care there.`,
      );
    }
    return {
      ...empty,
      headline: "We can't say one route is safer",
      reasons,
      hazardsOnRecommended: fastest.hazardZones.map((z) => z.label),
    };
  }

  // --- Fastest route is also the safest. -------------------------------------------
  if (safer === fastest) {
    const reasons: string[] = [
      "It is the quickest option and also has the lowest mapped road-risk of the routes compared.",
    ];
    for (const other of routes) {
      if (other === safer) continue;
      const a = safer.safety.exposure;
      const b = other.safety.exposure;
      if (a && b) {
        const rough = b.unpavedKm + b.roughKm - (a.unpavedKm + a.roughKm);
        if (rough >= MIN_KM_DIFFERENCE) {
          reasons.push(
            `The alternative has ${km(rough)} more rough or unpaved road.`,
          );
          break;
        }
      }
    }
    const avoided = routes
      .filter((r) => r !== safer)
      .flatMap((r) => r.hazardZones)
      .filter((z) => !safer.hazardZones.some((h) => h.id === z.id));
    if (avoided.length > 0) {
      reasons.push(
        `It avoids ${[...new Set(avoided.map((z) => z.label))].join(", ")}, a known accident-prone ${plural(avoided.length, "spot", "spots")} on another route.`,
      );
    }
    return {
      ...empty,
      verdict: "fastest-is-safest",
      headline: "Fastest route is also the safest option",
      reasons,
      hazardsOnRecommended: safer.hazardZones.map((z) => z.label),
    };
  }

  // --- A different route is safer than the fastest. --------------------------------
  const reasons: string[] = [];

  const avoided = fastest.hazardZones.filter(
    (z) => !safer.hazardZones.some((h) => h.id === z.id),
  );
  if (avoided.length > 0) {
    reasons.push(
      `Avoids ${avoided.map((z) => z.label).join(", ")}, a known accident-prone ${plural(avoided.length, "spot", "spots")} on the fastest route.`,
    );
  }

  const a = fastest.safety.exposure;
  const b = safer.safety.exposure;
  if (a && b) {
    const rough = a.unpavedKm + a.roughKm - (b.unpavedKm + b.roughKm);
    if (rough >= MIN_KM_DIFFERENCE) {
      reasons.push(
        `${km(rough)} less rough or unpaved road than the fastest route.`,
      );
    }
    const minor = a.minorRoadKm - b.minorRoadKm;
    if (minor >= MIN_KM_DIFFERENCE) {
      reasons.push(`${km(minor)} less on narrow, minor or unclassified roads.`);
    }
    const fast = a.highSpeedKm - b.highSpeedKm;
    if (fast >= MIN_KM_DIFFERENCE) {
      reasons.push(
        `${km(fast)} less on roads with a posted speed of 80 km/h or more.`,
      );
    }
    if (isNight && a.unlitKm != null && b.unlitKm != null) {
      const unlit = a.unlitKm - b.unlitKm;
      if (unlit >= MIN_KM_DIFFERENCE) {
        reasons.push(
          `${km(unlit)} less on unlit road, which matters because it's dark.`,
        );
      }
    }
  }
  const newHazards = safer.hazardZones.filter(
    (z) => !fastest.hazardZones.some((h) => h.id === z.id),
  );

  if (reasons.length === 0) {
    reasons.push(
      "It scores lower on the combined mapped road-risk estimate (surface, smoothness, road type, speed limits).",
    );
  }
  if (newHazards.length > 0) {
    reasons.push(
      `Heads-up: it still passes ${newHazards.map((z) => z.label).join(", ")}, a known accident-prone spot.`,
    );
  }

  const extraMinutes = Math.max(0, safer.durationMin - fastest.durationMin);
  const extraKm = Math.max(0, safer.distanceKm - fastest.distanceKm);

  return {
    verdict: "safer-alternative",
    headline:
      extraMinutes > 0
        ? `A safer route is available, +${extraMinutes} min`
        : "A safer route is available, no extra time",
    reasons,
    hazardsOnRecommended: safer.hazardZones.map((z) => z.label),
    fastest,
    safer,
    extraMinutes,
    extraKm: Math.round(extraKm * 10) / 10,
  };
}
