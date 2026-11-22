import { z } from "zod";
import {
  tokenSchema,
  sampleSchema,
  meetingSchema,
  sosSchema,
} from "./companion-tracking";
const tripId = z.string().uuid();
export const guardianActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("invite"),
    tripId,
    travellerId: z.string().uuid(),
  }),
  z.object({ action: z.literal("revoke"), tripId, linkId: z.string().uuid() }),
  z.object({ action: z.literal("meeting"), tripId, point: meetingSchema }),
  z.object({ action: z.literal("clear"), tripId }),
  z.object({
    action: z.literal("resolve"),
    tripId,
    incidentId: z.string().uuid(),
    status: z.enum(["resolved", "false_alarm"]),
  }),
  sosSchema.extend({ action: z.literal("sos"), tripId: tripId.optional() }),
]);
export const companionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), token: tokenSchema }),
  z.object({
    action: z.literal("location"),
    token: tokenSchema,
    sample: sampleSchema,
  }),
  z.object({ action: z.literal("pause"), token: tokenSchema }),
  z.object({ action: z.literal("stop"), token: tokenSchema }),
  sosSchema.extend({ action: z.literal("sos"), token: tokenSchema }),
]);
export type GuardianAction = z.infer<typeof guardianActionSchema>;
export type CompanionAction = z.infer<typeof companionActionSchema>;
