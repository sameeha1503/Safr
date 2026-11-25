type Point = { lat: number; lng: number };

export type HazardZone = Point & {
  id: string;
  radius_meters: number;
  label: string;
  kind: string;
  description: string;
  source_url: string;
};

/** Check each line segment against the seeded radius, including between routing vertices. */
export function hazardZonesOnRoute(
  points: Point[],
  zones: HazardZone[],
): HazardZone[] {
  return zones.filter((zone) => {
    if (!Number.isFinite(zone.radius_meters) || zone.radius_meters <= 0)
      return false;
    const metersPerDegree = (Math.PI * 6371000) / 180;
    const lonScale = metersPerDegree * Math.cos((zone.lat * Math.PI) / 180);
    return points.some((end, i) => {
      const start = points[Math.max(0, i - 1)]!;
      const x = (start.lng - zone.lng) * lonScale;
      const y = (start.lat - zone.lat) * metersPerDegree;
      const dx = (end.lng - start.lng) * lonScale;
      const dy = (end.lat - start.lat) * metersPerDegree;
      const lengthSquared = dx * dx + dy * dy;
      const fraction =
        lengthSquared === 0
          ? 0
          : Math.max(0, Math.min(1, -(x * dx + y * dy) / lengthSquared));
      return (
        Math.hypot(x + dx * fraction, y + dy * fraction) <= zone.radius_meters
      );
    });
  });
}
