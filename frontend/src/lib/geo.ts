export type Coordinate = { lat: number; lng: number };
export type NearbyPlace = Coordinate & {
  id: string;
  name: string;
  category: "restaurant" | "hotel" | "attraction";
  kind: string;
  openingHours?: string | undefined;
  cuisine?: string | undefined;
  distanceKm: number;
  routeDistanceKm?: number | undefined;
  sourceUrl: string;
  highlight?: string | undefined;
  interests?: string[] | undefined;
};

export function distanceKm(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}

// Distance to line segments, rather than just vertices, keeps long road sections searchable.
export function distanceToRoute(point: Coordinate, path: Coordinate[]): number {
  if (!path.length) return Infinity;
  if (path.length === 1) return distanceKm(point, path[0]!);
  const scale = Math.cos((point.lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!,
      b = path[i]!;
    const ax = (a.lng - point.lng) * scale,
      ay = a.lat - point.lat;
    const dx = (b.lng - a.lng) * scale,
      dy = b.lat - a.lat;
    const length = dx * dx + dy * dy;
    const t = length
      ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length))
      : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy) * 111.195);
  }
  return best;
}
