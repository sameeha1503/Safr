import { haversineDistanceMeters } from "./geo-math";
import type { RouteStep } from "@/lib/maps.server";

export interface NavigationPoint {
  lat: number;
  lng: number;
}

export interface NavigationProgress {
  snapped: NavigationPoint;
  offRouteMeters: number;
  offRoute: boolean;
  arrived: boolean;
  progress: number;
  remainingMeters: number;
  remainingSeconds: number;
  stepIndex: number;
  nextStep: RouteStep | null;
  distanceToStepMeters: number | null;
}

function projectToSegment(
  point: NavigationPoint,
  start: NavigationPoint,
  end: NavigationPoint,
) {
  const latScale = 111_320;
  const lngScale = Math.max(1, 111_320 * Math.cos((point.lat * Math.PI) / 180));
  const ax = (start.lng - point.lng) * lngScale;
  const ay = (start.lat - point.lat) * latScale;
  const bx = (end.lng - point.lng) * lngScale;
  const by = (end.lat - point.lat) * latScale;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const t =
    denominator === 0
      ? 0
      : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return {
    t,
    distance: Math.hypot(x, y),
    snapped: {
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    },
  };
}

export function parseRoutePolyline(polyline?: string): NavigationPoint[] {
  if (!polyline) return [];
  try {
    const value = JSON.parse(polyline) as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((coordinate) =>
      Array.isArray(coordinate) &&
      coordinate.length >= 2 &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1]) &&
      Math.abs(coordinate[0]) <= 90 &&
      Math.abs(coordinate[1]) <= 180
        ? [{ lat: Number(coordinate[0]), lng: Number(coordinate[1]) }]
        : [],
    );
  } catch {
    return [];
  }
}

export function deriveNavigationProgress({
  position,
  accuracyMeters,
  path,
  steps,
  durationSeconds,
}: {
  position: NavigationPoint;
  accuracyMeters: number | null;
  path: NavigationPoint[];
  steps: RouteStep[];
  durationSeconds: number;
}): NavigationProgress | null {
  if (path.length < 2) return null;
  const segmentLengths = path
    .slice(1)
    .map((point, index) =>
      haversineDistanceMeters(
        path[index]!.lat,
        path[index]!.lng,
        point.lat,
        point.lng,
      ),
    );
  const total = segmentLengths.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestAlong = 0;
  let bestSnapped = path[0]!;
  let before = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const projection = projectToSegment(
      position,
      path[index]!,
      path[index + 1]!,
    );
    if (projection.distance < bestDistance) {
      bestDistance = projection.distance;
      bestAlong = before + segmentLengths[index]! * projection.t;
      bestSnapped = projection.snapped;
    }
    before += segmentLengths[index]!;
  }

  const stepAlong = steps.map((step) => {
    if (!step.location) return Number.POSITIVE_INFINITY;
    const target = { lat: step.location[0], lng: step.location[1] };
    let closest = Number.POSITIVE_INFINITY;
    let along = total;
    let prefix = 0;
    for (let index = 0; index < path.length - 1; index += 1) {
      const projection = projectToSegment(
        target,
        path[index]!,
        path[index + 1]!,
      );
      if (projection.distance < closest) {
        closest = projection.distance;
        along = prefix + segmentLengths[index]! * projection.t;
      }
      prefix += segmentLengths[index]!;
    }
    return along;
  });
  const nextIndex = stepAlong.findIndex(
    (value) => Number.isFinite(value) && value >= bestAlong - 15,
  );
  const nextStep = steps[nextIndex] ?? null;
  const remainingMeters = Math.max(0, total - bestAlong);
  const threshold = Math.max(45, Math.min(120, (accuracyMeters ?? 20) * 1.5));
  const arrived =
    accuracyMeters !== null &&
    accuracyMeters <= 50 &&
    remainingMeters <= 35 &&
    haversineDistanceMeters(
      position.lat,
      position.lng,
      path.at(-1)!.lat,
      path.at(-1)!.lng,
    ) <= 35;

  return {
    snapped: bestSnapped,
    offRouteMeters: Math.round(bestDistance),
    offRoute: bestDistance > threshold,
    arrived,
    progress: Math.max(0, Math.min(1, bestAlong / total)),
    remainingMeters,
    remainingSeconds: Math.max(
      0,
      Math.round(durationSeconds * (remainingMeters / total)),
    ),
    stepIndex: nextStep ? nextIndex : Math.max(0, steps.length - 1),
    nextStep,
    distanceToStepMeters:
      nextStep?.location == null
        ? null
        : Math.max(0, stepAlong[nextIndex]! - bestAlong),
  };
}

export function acceptGpsSample({
  previous,
  next,
}: {
  previous: (NavigationPoint & { timestamp: number; accuracy: number }) | null;
  next: NavigationPoint & { timestamp: number; accuracy: number };
}) {
  if (
    !Number.isFinite(next.lat) ||
    !Number.isFinite(next.lng) ||
    Math.abs(next.lat) > 90 ||
    Math.abs(next.lng) > 180 ||
    !Number.isFinite(next.timestamp) ||
    !Number.isFinite(next.accuracy) ||
    next.accuracy <= 0 ||
    next.accuracy > 1000
  )
    return false;
  if (!previous) return true;
  if (next.timestamp <= previous.timestamp) return false;
  const elapsed = Math.max(0.1, (next.timestamp - previous.timestamp) / 1000);
  const impliedSpeed =
    haversineDistanceMeters(previous.lat, previous.lng, next.lat, next.lng) /
    elapsed;
  return impliedSpeed <= 70 || next.accuracy < previous.accuracy / 2;
}
