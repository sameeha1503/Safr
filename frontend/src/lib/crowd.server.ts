import { z } from "zod";
import { aggregateCrowd, CROWD_LEVELS, type CrowdLevel } from "./crowd";

const reportSchema = z.array(
  z.object({
    user_id: z.string(),
    level: z.enum(CROWD_LEVELS),
    created_at: z.string(),
  }),
);
export async function loadCrowd(placeKey: string) {
  try {
    const { supabaseAdmin } =
      await import("../integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("crowd_reports")
      .select("user_id,level,created_at")
      .eq("place_key", placeKey)
      .gte("created_at", new Date(Date.now() - 90 * 60000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1000)
      .abortSignal(AbortSignal.timeout(3000));
    if (error)
      return { available: false as const, crowd: { band: null } as const };
    return {
      available: true as const,
      crowd: aggregateCrowd(reportSchema.parse(data || []), new Date()),
    };
  } catch {
    return { available: false as const, crowd: { band: null } as const };
  }
}
export async function saveCrowdReport(
  userId: string,
  placeKey: string,
  level: CrowdLevel,
) {
  try {
    const { supabaseAdmin } =
      await import("../integrations/supabase/client.server");
    const { data: recent, error: readError } = await supabaseAdmin
      .from("crowd_reports")
      .select("created_at")
      .eq("user_id", userId)
      .eq("place_key", placeKey)
      .gte("created_at", new Date(Date.now() - 30 * 60000).toISOString())
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    if (readError)
      return {
        ok: false,
        message: "Crowd reporting is temporarily unavailable.",
      };
    if (recent?.length)
      return {
        ok: false,
        message: "You can report this place once every 30 minutes.",
      };
    const { error } = await supabaseAdmin
      .from("crowd_reports")
      .insert({ user_id: userId, place_key: placeKey, level })
      .abortSignal(AbortSignal.timeout(3000));
    if (error)
      return {
        ok: false,
        message:
          error.code === "P0001"
            ? "You can report this place once every 30 minutes."
            : "Your report could not be saved. Please try again.",
      };
    return { ok: true, message: "Thanks for reporting current crowd levels." };
  } catch {
    return {
      ok: false,
      message: "Crowd reporting is temporarily unavailable.",
    };
  }
}
