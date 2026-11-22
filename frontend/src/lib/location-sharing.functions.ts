import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import {
  guardianActionSchema,
  companionActionSchema,
} from "./tracking-actions";
export const getTrackingWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ tripId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const server = await import("./location-sharing.server");
    return server.getTrackingWorkspace(context.userId, data.tripId);
  });
export const guardianTrackingAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => guardianActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const server = await import("./location-sharing.server");
    return server.runGuardianAction(context.userId, data);
  });
export const companionTrackingAction = createServerFn({ method: "POST" })
  .validator((input: unknown) => companionActionSchema.parse(input))
  .handler(async ({ data }) => {
    const server = await import("./location-sharing.server");
    const request = getRequest();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    server.checkTrackingAccess(`ip:${ip}`);
    return server.runCompanionAction(data);
  });
