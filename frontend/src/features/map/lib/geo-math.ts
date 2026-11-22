/**
 * Pure geospatial and angular mathematics.
 * NOTE: Do NOT import maplibre-gl, React, or DOM APIs in this file.
 */

/**
 * Returns meters per pixel for MapLibre 512px tiles at a given latitude and zoom level.
 * Formula: 78271.51696 * cos(lat) / 2^zoom
 */
export function metersPerPixel(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  const cosLat = Math.cos(rad);
  const mpp = (78271.51696 * Math.max(0, cosLat)) / Math.pow(2, zoom);
  return Math.max(1e-7, mpp);
}

/**
 * Normalizes any angle in degrees to the [0, 360) range.
 */
export function normalizeHeading(h: number): number {
  const normalized = ((h % 360) + 360) % 360;
  return normalized === 360 ? 0 : normalized;
}

/**
 * Computes the signed shortest angular delta from `a` to `b` in degrees.
 * Returns a value in [-180, 180).
 * Positive means turn clockwise from a to b; negative means counterclockwise.
 */
export function angleDelta(a: number, b: number): number {
  const normA = normalizeHeading(a);
  const normB = normalizeHeading(b);
  let diff = (normB - normA) % 360;
  if (diff > 180) diff -= 360;
  if (diff <= -180) diff += 360;
  return diff;
}

/**
 * Smoothly interpolates an angle from `prev` towards `next` along the shortest arc
 * across the 0/360 discontinuity with smoothing factor `alpha` (0 to 1).
 */
export function smoothAngle(prev: number, next: number, alpha: number): number {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const delta = angleDelta(prev, next);
  return normalizeHeading(prev + delta * clampedAlpha);
}

/**
 * Great-circle distance between two points in meters using Haversine formula.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
