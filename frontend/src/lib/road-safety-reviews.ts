import { z } from "zod";

export const roadSafetyReviewInput = z.object({
  lat: z.number().min(14.8).max(15.9),
  lng: z.number().min(73.6).max(74.4),
  safety_rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(280).optional(),
});
export type RoadSafetyReviewInput = z.infer<typeof roadSafetyReviewInput>;

export type RoadSafetyReview = {
  id: string;
  lat: number;
  lng: number;
  safety_rating: number;
  comment: string | null;
  created_at: string;
};

export const roadSafetyReviewsBoundsSchema = z
  .object({
    minLat: z.number().optional(),
    maxLat: z.number().optional(),
    minLng: z.number().optional(),
    maxLng: z.number().optional(),
  })
  .optional();
export type RoadSafetyReviewsBounds = z.infer<typeof roadSafetyReviewsBoundsSchema>;
