import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { roadReportInput } from "./road-reports";

export const getRoadReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { data, error } = await context.supabase
        .from("road_reports")
        .select("id,lat,lng,kind,detail,status,created_at,expires_at")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(100)
        .abortSignal(AbortSignal.timeout(5000));
      return { available: !error, reports: data ?? [] };
    } catch {
      return { available: false, reports: [] };
    }
  });

export const submitRoadReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => roadReportInput.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { checkExploreAccess } = await import("./explore-access.server");
      checkExploreAccess(context.userId);
      const { error } = await context.supabase
        .from("road_reports")
        .insert({ ...data, user_id: context.userId })
        .abortSignal(AbortSignal.timeout(5000));
      return {
        ok: !error,
        message: error
          ? error.code === "P0001"
            ? "You can submit three reports per hour. Please wait."
            : "Road reporting is unavailable. Please try later."
          : "Submitted for review. Reports expire after six hours.",
      };
    } catch {
      return {
        ok: false,
        message: "Road reporting is unavailable. Please try later.",
      };
    }
  });
