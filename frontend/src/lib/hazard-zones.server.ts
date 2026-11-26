import { supabaseAdmin } from "../integrations/supabase/client.server";
export { hazardZonesOnRoute, type HazardZone } from "./hazard-zones";

import type { HazardZone } from "./hazard-zones";

export async function fetchKnownHazardZones(): Promise<HazardZone[] | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("known_hazard_zones")
      .select("id,lat,lng,radius_meters,label,kind,description,source_url")
      .abortSignal(AbortSignal.timeout(5000));
    return error ? null : data;
  } catch {
    return null;
  }
}
