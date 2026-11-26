import { supabaseAdmin } from "../integrations/supabase/client.server";
export { hazardZonesOnRoute, type HazardZone } from "./hazard-zones";

import type { HazardZone } from "./hazard-zones";

export async function fetchKnownHazardZones(): Promise<HazardZone[] | null> {
  console.log(
    "[hazard-zones] env check: SUPABASE_URL set =",
    !!process.env["SUPABASE_URL"],
    "SERVICE_ROLE set =",
    !!process.env["SUPABASE_SERVICE_ROLE_KEY"],
  );
  try {
    const { data, error } = await supabaseAdmin
      .from("known_hazard_zones")
      .select("id,lat,lng,radius_meters,label,kind,description,source_url")
      .abortSignal(AbortSignal.timeout(5000));
    if (error) {
      console.error(
        "[hazard-zones] Supabase query failed:",
        error.message,
        error.code,
        error.details,
      );
      return null;
    }
    console.log(`[hazard-zones] loaded ${data?.length ?? 0} zones`);
    return data;
  } catch (err: unknown) {
    console.error(
      "[hazard-zones] fetch threw:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
