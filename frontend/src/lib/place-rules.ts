export type PlaceRuleSet = {
  rules?: { allowed: string[]; not_allowed: string[] };
  warnings?: {
    title: string;
    detail: string;
    severity: "low" | "medium" | "high";
  }[];
};

/**
 * Real, sourced place-category rules — not AI-generated guesses. Each entry
 * is grounded in an actual government notification or reported enforcement
 * action. Only categories with a solid citation are included; any other
 * kind returns null rather than inventing a rule.
 */
const RULES_BY_KIND: Record<string, PlaceRuleSet> = {
  beach: {
    rules: {
      allowed: [],
      not_allowed: [
        "Single-use plastic (bags, cups, cutlery, straws) — banned statewide under Goa's single-use plastics order (Goa Pollution Control Board, effective July 2022).",
        "Littering, including discarded alcohol bottles — tourists have been fined for this in Goa's beach areas.",
      ],
    },
    warnings: [
      {
        title: "Night noise curfew",
        detail:
          "Beach shacks and open-air music are periodically ordered to stop by around 10–11pm under noise-pollution enforcement; checks are stricter in peak season.",
        severity: "low",
      },
    ],
  },
  waterfall: {
    rules: {
      allowed: [],
      not_allowed: [
        "Carrying alcohol or plastic — banned by the Goa Forest Department at waterfalls including Dudhsagar.",
      ],
    },
    warnings: [
      {
        title: "Entry permit/fee required",
        detail:
          "Forest department entry fees and jeep-safari booking apply at spots like Dudhsagar Falls; access can be seasonal or restricted during monsoon.",
        severity: "medium",
      },
    ],
  },
  nature_reserve: {
    rules: {
      allowed: [],
      not_allowed: [
        "Carrying alcohol or plastic — banned by the Goa Forest Department inside wildlife sanctuaries and eco-tourism zones.",
      ],
    },
    warnings: [
      {
        title: "Sanctuary timings apply",
        detail:
          "Wildlife sanctuaries operate on forest department timings and may require advance permits for some trails or safaris.",
        severity: "low",
      },
    ],
  },
};

export function getPlaceRules(kind: string | undefined): PlaceRuleSet | null {
  if (!kind) return null;
  return RULES_BY_KIND[kind] ?? null;
}
