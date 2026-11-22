import type { Coordinate } from "./geo";

/** Ignore incomplete or invalid URL coordinates rather than changing geocoding. */
export function resolvedCentre(
  lat: unknown,
  lng: unknown,
): Coordinate | undefined {
  const number = (value: unknown) =>
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  const latitude = number(lat);
  const longitude = number(lng);
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
    ? { lat: latitude, lng: longitude }
    : undefined;
}
