import { mkdir, writeFile, rename } from "node:fs/promises";

// A single administrative-area query, never a tile scrape or a per-visitor query.
const query = `[out:json][timeout:120];area["ISO3166-2"="IN-GA"]["admin_level"="4"]->.goa;
(nwr(area.goa)[name][tourism];nwr(area.goa)[name][amenity];
nwr(area.goa)[name][shop];nwr(area.goa)[name][historic];
nwr(area.goa)[name][natural];nwr(area.goa)[name][leisure];
nwr(area.goa)[name][public_transport];nwr(area.goa)[name][railway=station];
nwr(area.goa)[name][aeroway=aerodrome];);out center tags;`;
const endpoint =
  process.env.OVERPASS_URL ||
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter";
const url = new URL(endpoint);
url.searchParams.set("data", query);
const response = await fetch(url, {
  headers: {
    Accept: "application/json",
    "User-Agent": "Safr/1.0 (Goa tourism catalogue)",
  },
  signal: AbortSignal.timeout(150000),
});
if (!response.ok) throw new Error(`OSM download failed: ${response.status}`);
const result = await response.json();
if (result.remark || !Array.isArray(result.elements) || !result.elements.length)
  throw new Error(
    result.remark || "Empty OSM response; keeping the previous catalogue.",
  );
const allowed = [
  "name",
  "name:en",
  "tourism",
  "amenity",
  "shop",
  "historic",
  "natural",
  "leisure",
  "public_transport",
  "railway",
  "aeroway",
  "opening_hours",
  "website",
  "contact:website",
  "phone",
  "contact:phone",
  "cuisine",
  "addr:city",
  "addr:street",
  "addr:housenumber",
  "wheelchair",
];
const places = result.elements
  .flatMap((e) => {
    const lat = e.lat ?? e.center?.lat,
      lng = e.lon ?? e.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !e.tags?.name)
      return [];
    return [
      {
        id: `${e.type}/${e.id}`,
        lat,
        lng,
        tags: Object.fromEntries(
          allowed.filter((k) => e.tags[k]).map((k) => [k, e.tags[k]]),
        ),
      },
    ];
  })
  .sort((a, b) => a.id.localeCompare(b.id));
const directory = new URL("../../frontend/public/data/", import.meta.url);
await mkdir(directory, { recursive: true });
const target = new URL("goa-places.json", directory);
const temporary = new URL("goa-places.json.tmp", directory);
await writeFile(
  temporary,
  JSON.stringify({
    source: "OpenStreetMap contributors",
    license: "ODbL-1.0",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    fetchedAt: new Date().toISOString(),
    osmTimestamp: result.osm3s?.timestamp_osm_base,
    scope:
      "Named points of interest within the Goa administrative boundary; not a complete business directory.",
    places,
  }),
);
await rename(temporary, target);
console.log(`Saved ${places.length} Goa places to ${target.pathname}`);
