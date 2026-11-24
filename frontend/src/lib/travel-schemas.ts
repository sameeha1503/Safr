import { z } from "zod";

export const coordinateSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
export const itineraryInputSchema = z.object({
  place: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(80).default("Goa"),
  hours: z.number().int().min(1).max(24),
  interests: z.array(z.string().max(40)).min(1).max(8),
  pace: z.enum(["relaxed", "balanced", "packed"]),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("09:00"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => {
      const date = new Date(`${s}T00:00:00Z`);
      return (
        Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s
      );
    }, "Choose a valid date")
    .optional(),
  notes: z.string().trim().max(400).optional(),
  origin: coordinateSchema.optional(),
  start: coordinateSchema
    .extend({ name: z.string().max(120).optional() })
    .optional(),
  destination: coordinateSchema.optional(),
  returnToStart: z.boolean().default(false),
});
