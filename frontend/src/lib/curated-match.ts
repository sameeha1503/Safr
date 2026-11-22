import { normalizePlaceName } from "./place-names";
import { distanceKm } from "./geo";
import type { CuratedPlace } from "./goa-places-data";

export function matchCuratedPlace(
  name: string,
  lat: number,
  lng: number,
  places: readonly CuratedPlace[],
): CuratedPlace | null {
  const normalized = normalizePlaceName(name);
  const candidates = places
    .map((place) => {
      const other = normalizePlaceName(place.name);
      const matches = Boolean(
        normalized &&
        other &&
        (normalized === other ||
          normalized.includes(other) ||
          other.includes(normalized)),
      );
      return { place, matches, distance: distanceKm({ lat, lng }, place) };
    })
    .filter(
      ({ matches, distance }) => (matches && distance < 1.5) || distance < 0.3,
    )
    .sort(
      (a, b) =>
        Number(b.matches) - Number(a.matches) || a.distance - b.distance,
    );
  return candidates[0]?.place || null;
}
