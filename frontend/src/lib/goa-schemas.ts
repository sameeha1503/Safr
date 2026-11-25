import { z } from "zod";

export const recommendationSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  sourceUrl: z.string().url().optional(),
  name: z.string(),
  kind: z.string().optional(),
  openingHours: z.string().optional(),
  distanceKm: z.number().optional(),
  description: z.string(),
  tip: z.string(),
});

export const placeInsightsSchema = z.object({
  place: z.string(),
  location: z.object({
    name: z.string(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    state: z.string(),
  }),
  media: z
    .object({
      imageUrl: z.string().url(),
      credit: z.object({ label: z.string(), url: z.string().url() }),
    })
    .optional(),
  wikipedia: z
    .object({
      title: z.string(),
      extract: z.string(),
      pageUrl: z.string().url(),
      license: z.literal("CC BY-SA 4.0"),
    })
    .optional(),
  curated: z
    .object({
      highlight: z.string().optional(),
      bestTime: z
        .enum(["morning", "afternoon", "sunset", "evening", "any"])
        .optional(),
      interests: z.array(z.string()),
      kind: z.string(),
    })
    .optional(),
  seasonNotes: z.array(z.string()).optional(),
  summary: z.string(),
  eat: z.array(recommendationSchema).max(6),
  activities: z.array(recommendationSchema).max(6),
  sights: z.array(recommendationSchema).max(6),
  rules: z
    .object({
      allowed: z.array(z.string()).max(8),
      not_allowed: z.array(z.string()).max(8),
    })
    .optional(),
  warnings: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        severity: z.enum(["low", "medium", "high"]),
      }),
    )
    .max(6)
    .optional(),
});

export type PlaceInsights = z.infer<typeof placeInsightsSchema>;

export const itinerarySchema = z.object({
  totalMinutes: z.number().optional(),
  unusedMinutes: z.number().optional(),
  returnMinutes: z.number().optional(),
  budgetMinutes: z.number().optional(),
  endTime: z.string().optional(),
  aiStatus: z.enum(["used", "unavailable", "not_configured"]).optional(),
  routingSource: z.string().optional(),
  origin: z.object({ lat: z.number(), lng: z.number() }).optional(),
  title: z.string(),
  overview: z.string(),
  date: z.string().optional(),
  stops: z
    .array(
      z.object({
        id: z.string().optional(),
        durationMin: z.number().optional(),
        arrivalMinute: z.number().optional(),
        departureMinute: z.number().optional(),
        sourceUrl: z.string().url().optional(),
        time: z.string(),
        title: z.string(),
        type: z.enum(["food", "sight", "activity", "beach", "rest", "travel"]),
        duration: z.string(),
        description: z.string(),
        travel_note: z.string(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        crowdLevel: z.enum(["low", "moderate", "high"]).optional(),
        distanceKm: z.number().optional(),
        transitMin: z.number().optional(),
        slot: z
          .enum(["en-route", "main", "meal", "sunset", "arrive"])
          .optional(),
        why: z.string().optional(),
        openStatus: z.enum(["open", "unknown"]).optional(),
        detourMin: z.number().optional(),
        source: z.enum(["catalogue", "overpass", "curated"]).optional(),
        kind: z.string().optional(),
      }),
    )
    .min(1)
    .max(12),
  tips: z.array(z.string()).min(2).max(6),
  journey: z
    .object({
      start: z.object({
        lat: z.number(),
        lng: z.number(),
        name: z.string().optional(),
      }),
      destination: z.object({
        lat: z.number(),
        lng: z.number(),
        name: z.string().optional(),
      }),
      routeKm: z.number().optional(),
      routeMin: z.number().optional(),
      hazardZones: z.array(z.string()).optional(),
      safetyNotes: z.array(z.string()).optional(),
      routeLine: z.array(z.tuple([z.number(), z.number()])).optional(),
      arriveAfterDark: z.boolean().optional(),
      returnByText: z.string().optional(),
    })
    .optional(),
  mode: z.enum(["journey", "anchor"]).optional(),
  degraded: z.boolean().optional(),
  liveWeather: z.string().optional(),
  liveSwell: z.string().optional(),
});

export type Itinerary = z.infer<typeof itinerarySchema>;

export const routeStepSchema = z.object({
  instruction: z.string(),
  distanceMeters: z.number(),
  durationSeconds: z.number(),
  maneuverType: z.string(),
  maneuverModifier: z.string().optional(),
  name: z.string(),
  location: z.tuple([z.number(), z.number()]).optional(), // [lat, lng]
});

export type RouteStep = z.infer<typeof routeStepSchema>;

export const routeOptionSchema = z.object({
  label: z.string(),
  kind: z.enum(["fastest", "safer", "alt"]),
  distance_km: z.number(),
  duration_min: z.number(),
  safety_score: z.number(),
  reasons: z.array(z.string()),
  polyline: z.string(),
  summary: z.string(),
  steps: z.array(routeStepSchema).optional(),
  googleMapsUrl: z.string().optional(),
});

export type RouteOption = z.infer<typeof routeOptionSchema>;

export const GOA_PLACES = [
  "Panjim",
  "Baga Beach",
  "Calangute Beach",
  "Anjuna Beach",
  "Vagator Beach",
  "Candolim Beach",
  "Palolem Beach",
  "Agonda Beach",
  "Colva Beach",
  "Old Goa",
  "Dudhsagar Falls",
  "Fort Aguada",
  "Chapora Fort",
  "Margao",
  "Arambol Beach",
  "Morjim Beach",
] as const;
