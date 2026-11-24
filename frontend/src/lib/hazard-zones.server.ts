import { supabaseAdmin } from "../integrations/supabase/client.server";

export type HazardZone = {
  id: string;
  lat: number;
  lng: number;
  radius_meters: number;
  label: string;
  kind: string;
  description: string;
  source_url: string;
};

export async function fetchKnownHazardZones(): Promise<HazardZone[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("known_hazard_zones")
      .select("id,lat,lng,radius_meters,label,kind,description,source_url");
    if (error || !data) return [];
    return data as HazardZone[];
  } catch {
    return [];
  }
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Known accident-prone zones whose radius the route's geometry actually passes through. */
export function hazardZonesOnRoute(
  points: { lat: number; lng: number }[],
  zones: HazardZone[],
): HazardZone[] {
  return zones.filter((zone) =>
    points.some((p) => haversineMeters(p, zone) <= zone.radius_meters),
  );
}
