import type { CataloguePlace } from "@/features/map/lib/goa-catalogue";
import rawCatalogue from "../../public/data/goa-places.json" with { type: "json" };

export interface CatalogueBBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface OverpassElementLike {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

const AMENITY_REGEX =
  /^(restaurant|cafe|fast_food|food_court|bar|pub|nightclub|marketplace|place_of_worship)$/;
const TOURISM_REGEX =
  /^(hotel|guest_house|hostel|motel|attraction|museum|viewpoint|gallery|zoo|theme_park)$/;
const HISTORIC_REGEX = /^(castle|fort|monument|ruins|archaeological_site)$/;
const NATURAL_REGEX = /^(beach|waterfall)$/;
const LEISURE_REGEX = /^(water_park|sports_centre|park|nature_reserve)$/;

export function matchesCatalogueInterest(
  tags: Record<string, string>,
): boolean {
  if (tags["amenity"] && AMENITY_REGEX.test(tags["amenity"])) return true;
  if (tags["tourism"] && TOURISM_REGEX.test(tags["tourism"])) return true;
  if (tags["historic"]) return true;
  if (tags["natural"] && NATURAL_REGEX.test(tags["natural"])) return true;
  if (tags["leisure"] && LEISURE_REGEX.test(tags["leisure"])) return true;
  return false;
}

let cachedPlaces: CataloguePlace[] | null = null;

export function getLoadedCataloguePlaces(): CataloguePlace[] {
  if (cachedPlaces) return cachedPlaces;
  if (
    rawCatalogue &&
    Array.isArray((rawCatalogue as { places?: unknown }).places)
  ) {
    cachedPlaces = (rawCatalogue as { places: CataloguePlace[] }).places;
    return cachedPlaces;
  }
  return [];
}

/**
 * Returns places from the local Goa catalogue matching the bounding box,
 * formatted in the exact shape consumed by the Overpass parser in places.server.ts.
 */
export function cataloguePlacesInBox(
  bbox: CatalogueBBox,
): OverpassElementLike[] {
  const places = getLoadedCataloguePlaces();
  const matched: OverpassElementLike[] = [];

  for (const p of places) {
    if (
      p.lat >= bbox.minLat &&
      p.lat <= bbox.maxLat &&
      p.lng >= bbox.minLng &&
      p.lng <= bbox.maxLng
    ) {
      if (!p.tags || !matchesCatalogueInterest(p.tags)) {
        continue;
      }
      const slashIdx = p.id.indexOf("/");
      const typeStr = slashIdx !== -1 ? p.id.slice(0, slashIdx) : "node";
      const idNum =
        slashIdx !== -1 ? Number(p.id.slice(slashIdx + 1)) : Number(p.id) || 0;
      matched.push({
        type:
          typeStr === "way"
            ? "way"
            : typeStr === "relation"
              ? "relation"
              : "node",
        id: idNum,
        lat: p.lat,
        lon: p.lng,
        tags: p.tags,
      });
    }
  }

  return matched;
}
