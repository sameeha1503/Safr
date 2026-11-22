/**
 * Pure place picking and feature mapping logic.
 * NOTE: Do NOT import maplibre-gl, React, or DOM APIs in this file.
 */

export type PickedPlace = {
  id: string; // stable: `${source-layer}:${osm id or name}:${lat.toFixed(5)},${lng.toFixed(5)}`
  name: string; // prefer name:latin fallback name
  kindLabel: string; // "Beach", "Church", "Restaurant", "Village"...
  iconKey: string; // maps to a lucide icon
  lat: number;
  lng: number;
  rawClass?: string | undefined;
  rawSubclass?: string | undefined;
  catalogueDetails?: {
    openingHours?: string | undefined;
    phone?: string | undefined;
    website?: string | undefined;
    cuisine?: string | undefined;
  };
};

export interface RawFeatureLike {
  properties?: Record<string, unknown> | null;
  geometry: {
    type: string;
    coordinates: unknown;
  };
  "source-layer"?: string;
  sourceLayer?: string;
}

/**
 * Maps raw OpenMapTiles class/subclass to user-friendly category labels and Lucide icon keys.
 */
export function classifyPlace(
  rawClass?: string,
  rawSubclass?: string,
  name = "",
): { kindLabel: string; iconKey: string } {
  const cls = (rawClass || "").toLowerCase();
  const sub = (rawSubclass || "").toLowerCase();
  const n = name.toLowerCase();

  // 1. Beaches
  if (
    sub === "beach" ||
    cls === "beach" ||
    n.includes("beach") ||
    n.includes("praia")
  ) {
    return { kindLabel: "Beach", iconKey: "Umbrella" };
  }

  // 2. Religious & Historic Places
  if (
    sub === "church" ||
    sub === "cathedral" ||
    sub === "chapel" ||
    n.includes("church") ||
    n.includes("cathedral") ||
    n.includes("basilica")
  ) {
    return { kindLabel: "Church", iconKey: "Church" };
  }
  if (
    sub === "temple" ||
    sub === "hindu_temple" ||
    n.includes("temple") ||
    n.includes("devasthan")
  ) {
    return { kindLabel: "Temple", iconKey: "Landmark" };
  }
  if (sub === "mosque" || n.includes("mosque") || n.includes("masjid")) {
    return { kindLabel: "Mosque", iconKey: "Landmark" };
  }
  if (
    cls === "place_of_worship" ||
    sub === "place_of_worship" ||
    cls === "religion"
  ) {
    return { kindLabel: "Place of Worship", iconKey: "Landmark" };
  }
  if (
    cls === "historic" ||
    sub === "castle" ||
    sub === "fort" ||
    sub === "monument" ||
    sub === "ruins" ||
    n.includes("fort") ||
    n.includes("aguada") ||
    n.includes("chapora")
  ) {
    return { kindLabel: "Historic Fort / Monument", iconKey: "Castle" };
  }
  if (
    sub === "museum" ||
    cls === "museum" ||
    sub === "gallery" ||
    n.includes("museum")
  ) {
    return { kindLabel: "Museum", iconKey: "Landmark" };
  }

  // 3. Food, Drinks & Hospitality
  if (sub === "cafe" || cls === "cafe" || n.includes("cafe")) {
    return { kindLabel: "Café", iconKey: "Coffee" };
  }
  if (
    sub === "bar" ||
    cls === "bar" ||
    sub === "pub" ||
    cls === "pub" ||
    sub === "nightclub" ||
    n.includes("bar") ||
    n.includes("pub")
  ) {
    return { kindLabel: "Bar / Nightlife", iconKey: "Wine" };
  }
  if (
    sub === "restaurant" ||
    cls === "restaurant" ||
    cls === "food" ||
    sub === "fast_food" ||
    sub === "food_court"
  ) {
    return { kindLabel: "Restaurant", iconKey: "Utensils" };
  }
  if (
    sub === "hotel" ||
    cls === "hotel" ||
    cls === "lodging" ||
    sub === "resort" ||
    sub === "hostel" ||
    sub === "guest_house" ||
    sub === "motel" ||
    n.includes("resort") ||
    n.includes("hotel")
  ) {
    return { kindLabel: "Hotel / Stay", iconKey: "Hotel" };
  }

  // 4. Nature & Viewpoints
  if (
    sub === "viewpoint" ||
    cls === "viewpoint" ||
    n.includes("view point") ||
    n.includes("viewpoint")
  ) {
    return { kindLabel: "Scenic Viewpoint", iconKey: "Eye" };
  }
  if (
    sub === "waterfall" ||
    n.includes("waterfall") ||
    n.includes("falls") ||
    n.includes("dudhsagar")
  ) {
    return { kindLabel: "Waterfall", iconKey: "Waves" };
  }
  if (
    sub === "park" ||
    cls === "park" ||
    sub === "garden" ||
    sub === "nature_reserve" ||
    cls === "leisure"
  ) {
    return { kindLabel: "Park & Nature", iconKey: "Trees" };
  }

  // 5. Settlements / Places
  if (cls === "city") {
    return { kindLabel: "City", iconKey: "Building2" };
  }
  if (cls === "town") {
    return { kindLabel: "Town", iconKey: "Building" };
  }
  if (cls === "village" || n.includes("village")) {
    return { kindLabel: "Village", iconKey: "Home" };
  }
  if (
    cls === "hamlet" ||
    cls === "suburb" ||
    cls === "neighbourhood" ||
    cls === "locality"
  ) {
    return { kindLabel: "Neighborhood", iconKey: "MapPin" };
  }

  // 6. Transport & Emergency
  if (
    cls === "aerodrome" ||
    cls === "airport" ||
    n.includes("airport") ||
    n.includes("dabolim") ||
    n.includes("mopa")
  ) {
    return { kindLabel: "Airport", iconKey: "Plane" };
  }
  if (
    sub === "bus_station" ||
    sub === "bus_stop" ||
    sub === "ferry_terminal" ||
    cls === "transit"
  ) {
    return { kindLabel: "Transit Station", iconKey: "Bus" };
  }
  if (
    cls === "hospital" ||
    sub === "hospital" ||
    sub === "clinic" ||
    sub === "pharmacy"
  ) {
    return { kindLabel: "Medical", iconKey: "Hospital" };
  }
  if (cls === "police" || sub === "police") {
    return { kindLabel: "Police", iconKey: "Shield" };
  }
  if (cls === "fuel" || sub === "fuel") {
    return { kindLabel: "Fuel Station", iconKey: "Fuel" };
  }
  if (
    cls === "shop" ||
    sub === "supermarket" ||
    sub === "marketplace" ||
    sub === "bazaar"
  ) {
    return { kindLabel: "Shopping & Market", iconKey: "ShoppingBag" };
  }

  return { kindLabel: "Attraction", iconKey: "Sparkles" };
}

/**
 * Maps kindLabel to bucket list category enum expected in saved_places:
 * 'sight' | 'beach' | 'food' | 'stay' | 'culture' | 'nature'
 */
export function kindToCategory(kindLabel: string): string {
  const k = kindLabel.toLowerCase();
  if (k.includes("beach")) return "beach";
  if (
    k.includes("hotel") ||
    k.includes("stay") ||
    k.includes("resort") ||
    k.includes("lodging")
  )
    return "stay";
  if (
    k.includes("restaurant") ||
    k.includes("café") ||
    k.includes("cafe") ||
    k.includes("bar") ||
    k.includes("food")
  )
    return "food";
  if (
    k.includes("church") ||
    k.includes("temple") ||
    k.includes("mosque") ||
    k.includes("worship") ||
    k.includes("historic") ||
    k.includes("fort") ||
    k.includes("museum")
  )
    return "culture";
  if (
    k.includes("waterfall") ||
    k.includes("park") ||
    k.includes("nature") ||
    k.includes("viewpoint")
  )
    return "nature";
  return "sight";
}

/**
 * Extracts point coordinates from GeoJSON geometry.
 */
export function extractPointCoordinates(
  geometry: RawFeatureLike["geometry"],
): [number, number] | null {
  if (!geometry) return null;
  const coords = geometry.coordinates;

  if (geometry.type === "Point" && Array.isArray(coords)) {
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      return [coords[0], coords[1]];
    }
  }

  if (geometry.type === "LineString" && Array.isArray(coords)) {
    const midIdx = Math.floor(coords.length / 2);
    const pt = coords[midIdx];
    if (
      Array.isArray(pt) &&
      typeof pt[0] === "number" &&
      typeof pt[1] === "number"
    ) {
      return [pt[0], pt[1]];
    }
  }

  if (geometry.type === "Polygon" && Array.isArray(coords)) {
    const ring = coords[0];
    if (Array.isArray(ring) && ring.length > 0) {
      let sumLng = 0;
      let sumLat = 0;
      let count = 0;
      for (const pt of ring) {
        if (
          Array.isArray(pt) &&
          typeof pt[0] === "number" &&
          typeof pt[1] === "number"
        ) {
          sumLng += pt[0];
          sumLat += pt[1];
          count++;
        }
      }
      if (count > 0) {
        return [sumLng / count, sumLat / count];
      }
    }
  }

  return null;
}

/**
 * Pure mapper from a rendered map feature to a PickedPlace.
 * Returns null if the feature has no valid name or coordinates.
 */
export function featureToPickedPlace(
  feature: RawFeatureLike,
): PickedPlace | null {
  const props = feature.properties || {};
  const nameVal = props["name:latin"] || props["name_en"] || props["name"];
  if (typeof nameVal !== "string") return null;

  const name = nameVal.trim();
  if (!name) return null;

  const point = extractPointCoordinates(feature.geometry);
  if (!point) return null;

  const [lng, lat] = point;
  const sourceLayer = feature["source-layer"] || feature.sourceLayer || "place";
  const rawClass = typeof props["class"] === "string" ? props["class"] : "";
  const rawSubclass =
    typeof props["subclass"] === "string" ? props["subclass"] : "";

  const { kindLabel, iconKey } = classifyPlace(rawClass, rawSubclass, name);

  const rawId = props["osm_id"] ?? props["id"];
  const safeIdentifier =
    rawId != null
      ? String(rawId)
      : name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const id = `${sourceLayer}:${safeIdentifier}:${lat.toFixed(5)},${lng.toFixed(5)}`;

  return {
    id,
    name,
    kindLabel,
    iconKey,
    lat,
    lng,
    rawClass: rawClass || undefined,
    rawSubclass: rawSubclass || undefined,
  };
}
