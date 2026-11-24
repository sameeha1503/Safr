import { mkdir, writeFile, rename } from "node:fs/promises";

// A single administrative-area query, never a tile scrape or a per-visitor query.
const query = `[out:json][timeout:120];area["ISO3166-2"="IN-GA"]["admin_level"="4"]->.goa;
(nwr(area.goa)[name][tourism];nwr(area.goa)[name][amenity];
nwr(area.goa)[name][shop];nwr(area.goa)[name][historic];
nwr(area.goa)[name][natural];nwr(area.goa)[name][leisure];
nwr(area.goa)[name][public_transport];nwr(area.goa)[name][railway=station];
nwr(area.goa)[name][aeroway=aerodrome];);out center tags;`;
const endpoints = [
  process.env.OVERPASS_URL,
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
].filter(Boolean);

let result = null;
for (const endpoint of endpoints) {
  try {
    console.log(`Trying Overpass endpoint: ${endpoint}`);
    const url = new URL(endpoint);
    url.searchParams.set("data", query);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Safr/1.0 (Goa tourism catalogue)",
      },
      signal: AbortSignal.timeout(150000),
    });
    if (!response.ok) {
      console.warn(`Endpoint ${endpoint} returned status ${response.status}`);
      continue;
    }
    const data = await response.json();
    if (data.remark && (!Array.isArray(data.elements) || !data.elements.length)) {
      console.warn(`Endpoint ${endpoint} returned remark: ${data.remark}`);
      continue;
    }
    if (Array.isArray(data.elements) && data.elements.length > 0) {
      result = data;
      console.log(`Success from ${endpoint}: ${data.elements.length} raw elements received.`);
      break;
    }
  } catch (err) {
    console.warn(`Endpoint ${endpoint} failed:`, err instanceof Error ? err.message : err);
  }
}

if (!result || !Array.isArray(result.elements) || !result.elements.length) {
  throw new Error("Empty OSM response from all endpoints; keeping the previous catalogue.");
}
const allowed = [
  "name",
  "name:en",
  "description",
  "tourism",
  "amenity",
  "shop",
  "historic",
  "heritage",
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
  "wikipedia",
  "wikidata",
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
