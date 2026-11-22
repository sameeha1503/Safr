import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  roadSafetyReviewInput,
  roadSafetyReviewsBoundsSchema,
  type RoadSafetyReview,
  type RoadSafetyReviewInput,
  type RoadSafetyReviewsBounds,
} from "./road-safety-reviews";

export {
  roadSafetyReviewInput,
  roadSafetyReviewsBoundsSchema,
  type RoadSafetyReview,
  type RoadSafetyReviewInput,
  type RoadSafetyReviewsBounds,
};

export const getRoadSafetyReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    if (!input) return undefined;
    return roadSafetyReviewsBoundsSchema.parse(input);
  })
  .handler(async ({ data, context }) => {
    try {
      let query = (context.supabase as any)
        .from("road_safety_reviews")
        .select("id, lat, lng, safety_rating, comment, created_at")
        .order("created_at", { ascending: false })
        .limit(200)
        .abortSignal(AbortSignal.timeout(5000));

      if (
        data?.minLat !== undefined &&
        data?.maxLat !== undefined &&
        data?.minLng !== undefined &&
        data?.maxLng !== undefined
      ) {
        query = query
          .gte("lat", data.minLat)
          .lte("lat", data.maxLat)
          .gte("lng", data.minLng)
          .lte("lng", data.maxLng);
      }

      const { data: reviews, error } = await query;
      return {
        available: !error,
        reviews: ((reviews as unknown) ?? []) as RoadSafetyReview[],
      };
    } catch {
      return { available: false, reviews: [] };
    }
  });

export const submitRoadSafetyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => roadSafetyReviewInput.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { checkExploreAccess } = await import("./explore-access.server");
      checkExploreAccess(context.userId);
      const { error } = await (context.supabase as any)
        .from("road_safety_reviews")
        .insert({
          lat: data.lat,
          lng: data.lng,
          safety_rating: data.safety_rating,
          comment: data.comment ? data.comment.trim() : null,
          user_id: context.userId,
        })
        .abortSignal(AbortSignal.timeout(5000));

      if (error) {
        if (error.code === "P0001") {
          return {
            ok: false,
            message:
              "You've reached the review limit for now. Please try again later.",
          };
        }
        return {
          ok: false,
          message: "Unable to submit safety review. Please try again later.",
        };
      }
      return {
        ok: true,
        message: "Thank you! Your road safety review has been submitted.",
      };
    } catch (e) {
      const msg =
        e instanceof Error && e.message.includes("Please wait")
          ? e.message
          : "Safety review submission is unavailable. Please try later.";
      return {
        ok: false,
        message: msg,
      };
    }
  });
