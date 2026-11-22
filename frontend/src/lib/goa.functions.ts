import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { coordinateSchema, itineraryInputSchema } from "./travel-schemas";

export const getPlaceInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        place: z.string().trim().min(2).max(120),
        localTime: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { checkExploreAccess } = await import("./explore-access.server");
    checkExploreAccess(context.userId);
    const { loadPlaceInsights } = await import("./travel.server");
    return loadPlaceInsights(data.place);
  });

export const generateItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => itineraryInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { buildItinerary } = await import("./travel.server");
    return buildItinerary(data);
  });

export const getCurrentArea = createServerFn({ method: "POST" })
  .validator((input: unknown) => coordinateSchema.parse(input))
  .handler(async ({ data }) => {
    const { reverseLocation } = await import("./places.server");
    return reverseLocation(data);
  });

export const getFeaturedMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { checkExploreAccess } = await import("./explore-access.server");
    checkExploreAccess(context.userId);
    const { lookupWikipedia } = await import("./wikipedia.server");
    const { lookupWikimediaImage } = await import("./wikimedia.server");
    const { ALL_FEATURED } = await import("./explore-featured");
    const entries: [
      string,
      { imageUrl: string; credit: { label: string; url: string } } | null,
    ][] = [];
    // Keep public Wikimedia request bursts small; successful results are cached.
    for (let offset = 0; offset < ALL_FEATURED.length; offset += 2) {
      entries.push(
        ...(await Promise.all(
          ALL_FEATURED.slice(offset, offset + 2).map(
            async (place): Promise<(typeof entries)[number]> => {
              const article = await lookupWikipedia(place);
              const fallback = article?.imageUrl
                ? null
                : await lookupWikimediaImage(place);
              return [
                place.name,
                article?.imageUrl
                  ? {
                      imageUrl: article.imageUrl,
                      credit: {
                        label: "Wikipedia / Wikimedia — view image attribution",
                        url: article.pageUrl,
                      },
                    }
                  : fallback,
              ];
            },
          ),
        )),
      );
    }
    return Object.fromEntries(entries);
  });

export const getPlaceConditions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    coordinateSchema
      .extend({ kind: z.string().max(100).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { checkExploreAccess } = await import("./explore-access.server");
    checkExploreAccess(context.userId);
    const { fetchConditions } = await import("./conditions.server");
    const { deriveAdvisories } = await import("./conditions-advice");
    const conditions = await fetchConditions(data);
    return {
      conditions,
      advisories: deriveAdvisories(conditions, {
        kind: data.kind,
        now: new Date(),
      }),
    };
  });

export const getTravelTimes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        origin: coordinateSchema,
        destinations: z.array(coordinateSchema).max(12),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { checkExploreAccess } = await import("./explore-access.server");
    checkExploreAccess(context.userId);
    const { loadTravelTimes } = await import("./explore-travel.server");
    return loadTravelTimes(data.origin, data.destinations);
  });
export const getPlaceEssentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => coordinateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { checkExploreAccess } = await import("./explore-access.server");
    checkExploreAccess(context.userId);
    const { nearbyEssentials } = await import("./places.server");
    return nearbyEssentials(data);
  });
const placeKeySchema = z.string().trim().min(5).max(240);
export const getCrowd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ placeKey: placeKeySchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { checkExploreAccess } = await import("./explore-access.server");
    checkExploreAccess(context.userId);
    const { loadCrowd } = await import("./crowd.server");
    return loadCrowd(data.placeKey);
  });
export const submitCrowdReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        placeKey: placeKeySchema,
        level: z.enum(["quiet", "moderate", "busy", "packed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { checkExploreAccess } = await import("./explore-access.server");
    checkExploreAccess(context.userId);
    const { saveCrowdReport } = await import("./crowd.server");
    return saveCrowdReport(context.userId, data.placeKey, data.level);
  });

export const getPlaceNearby = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    coordinateSchema
      .extend({ name: z.string().trim().min(1).max(200) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { checkExploreAccess } = await import("./explore-access.server");
    checkExploreAccess(context.userId);
    const { loadPlaceNearby } = await import("./travel.server");
    return loadPlaceNearby(data);
  });

/** Optional article hydration lets a slow source fill the hero after core first paint. */
export const getPlaceArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    coordinateSchema
      .extend({ name: z.string().trim().min(1).max(200) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { checkExploreAccess } = await import("./explore-access.server");
    checkExploreAccess(context.userId);
    const { lookupWikipedia } = await import("./wikipedia.server");
    const { lookupWikimediaImage } = await import("./wikimedia.server");
    const article = await lookupWikipedia(data);
    const fallback = article?.imageUrl
      ? null
      : await lookupWikimediaImage(data);
    if (!article && !fallback) return null;
    return {
      ...(article ? { wikipedia: article } : {}),
      ...(article?.imageUrl
        ? {
            media: {
              imageUrl: article.imageUrl,
              credit: {
                label: "Wikipedia / Wikimedia — view image attribution",
                url: article.pageUrl,
              },
            },
          }
        : fallback
          ? { media: fallback }
          : {}),
    };
  });

export const getPlaceMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .array(
        z.object({
          key: z.string().min(1).max(300),
          name: z.string().trim().min(2).max(160),
          lat: z.number().min(-90).max(90).optional(),
          lng: z.number().min(-180).max(180).optional(),
        }),
      )
      .max(30)
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { checkExploreAccess } = await import("./explore-access.server");
    checkExploreAccess(context.userId);
    const { lookupWikimediaImage } = await import("./wikimedia.server");
    const entries: [
      string,
      { imageUrl: string; credit: { label: string; url: string } } | null,
    ][] = [];
    for (let offset = 0; offset < data.length; offset += 5) {
      entries.push(
        ...(await Promise.all(
          data.slice(offset, offset + 5).map(async (place) => {
            const media = await lookupWikimediaImage(place);
            return [place.key, media] as (typeof entries)[number];
          }),
        )),
      );
    }
    return Object.fromEntries(entries);
  });
