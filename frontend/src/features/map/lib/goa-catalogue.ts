import { classifyPlace, type PickedPlace } from "./place-picking";

export interface CataloguePlace {
  id: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
}
export interface GoaCatalogue {
  fetchedAt: string;
  osmTimestamp?: string;
  places: CataloguePlace[];
}
export const CATALOGUE_CATEGORIES = [
  "All",
  "Beaches",
  "Attractions",
  "Food & drink",
  "Stays",
  "Nature",
  "Shopping",
  "Transport",
  "Essentials",
] as const;
export type CatalogueCategory = (typeof CATALOGUE_CATEGORIES)[number];

export const ESSENTIAL_FILTERS = {
  Hospitals: ["amenity", "hospital"],
  Pharmacies: ["amenity", "pharmacy"],
  Police: ["amenity", "police"],
  Fuel: ["amenity", "fuel"],
  Toilets: ["amenity", "toilets"],
  Parking: ["amenity", "parking"],
  Ferries: ["amenity", "ferry_terminal"],
  "Bus stations": ["amenity", "bus_station"],
  Lifeguards: ["emergency", "lifeguard"],
} as const;
export type EssentialFilter = keyof typeof ESSENTIAL_FILTERS;
export function matchesEssential(
  place: CataloguePlace,
  filter: EssentialFilter | "All",
) {
  if (filter === "All") return true;
  const [key, value] = ESSENTIAL_FILTERS[filter];
  return place.tags[key] === value;
}

export function catalogueCategory({
  tags: t,
}: CataloguePlace): CatalogueCategory {
  if (t["natural"] === "beach") return "Beaches";
  if (
    [
      "restaurant",
      "cafe",
      "bar",
      "pub",
      "fast_food",
      "food_court",
      "ice_cream",
    ].includes(t["amenity"] || "")
  )
    return "Food & drink";
  if (
    [
      "hotel",
      "guest_house",
      "hostel",
      "motel",
      "apartment",
      "resort",
      "camp_site",
      "chalet",
    ].includes(t["tourism"] || "")
  )
    return "Stays";
  if (t["shop"]) return "Shopping";
  if (
    t["public_transport"] ||
    t["railway"] ||
    t["aeroway"] ||
    [
      "bus_station",
      "ferry_terminal",
      "taxi",
      "parking",
      "bicycle_rental",
      "car_rental",
    ].includes(t["amenity"] || "")
  )
    return "Transport";
  if (
    t["natural"] ||
    ["park", "nature_reserve", "garden"].includes(t["leisure"] || "")
  )
    return "Nature";
  if (t["tourism"] || t["historic"] || t["amenity"] === "place_of_worship")
    return "Attractions";
  return "Essentials";
}

export function cataloguePickedPlace(place: CataloguePlace): PickedPlace {
  const t = place.tags;
  const name = t["name:en"] || t["name"] || "Unnamed place";
  const kind =
    t["amenity"] ||
    t["tourism"] ||
    t["natural"] ||
    t["historic"] ||
    t["shop"] ||
    t["leisure"] ||
    t["railway"] ||
    t["public_transport"] ||
    t["aeroway"];
  return {
    id: place.id,
    name,
    lat: place.lat,
    lng: place.lng,
    ...classifyPlace(kind, kind, name),
    rawClass: kind,
    rawSubclass: kind,
    catalogueDetails: {
      openingHours: t["opening_hours"],
      phone: t["phone"] || t["contact:phone"],
      website: safeWebsite(t["website"] || t["contact:website"]),
      cuisine: t["cuisine"],
    },
  };
}

export function safeWebsite(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function filterCatalogue(
  places: CataloguePlace[],
  category: CatalogueCategory,
  query: string,
) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return places.filter((place) => {
    if (category !== "All" && catalogueCategory(place) !== category)
      return false;
    const searchable = Object.values(place.tags).join(" ").toLocaleLowerCase();
    return words.every((word) => searchable.includes(word));
  });
}
