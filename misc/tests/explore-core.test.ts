import test from "node:test";
import assert from "node:assert/strict";
import { loadPlaceInsights, loadPlaceNearby } from "../../frontend/src/lib/travel.server.ts";

test("core resolves coordinates and paints without calling Overpass or OSRM", async t => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(String(url));
    if (String(url).includes("photon")) return Response.json({ features: [{ geometry: { coordinates: [73.75, 15.55] }, properties: { name: "Baga", state: "Goa", countrycode: "in" } }] });
    return Response.json({ query: { geosearch: [] } });
  });
  const result = await loadPlaceInsights("Baga Beach");
  assert.equal(result?.location.name, "Baga");
  assert.equal(result?.location.lat, 15.55);
  assert.equal(result?.location.lng, 73.75);
  assert.ok(calls.every(url => !url.includes("overpass") && !url.includes("/table/")));
  assert.equal(result?.crowd, undefined);
});
test("core and nearby errors fail independently without network access", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("error", { status: 500 }));
  assert.equal(await loadPlaceInsights("Missing place"), null);
  assert.equal(await loadPlaceNearby({ name: "Missing place", lat: 0, lng: 0 }), null);
});
test("nearby results merge curated places with live fixtures within the requested radius", async t => {
  // Use a location with < 15 catalogue entries (Dudhsagar) to exercise the live Overpass fallback
  t.mock.method(globalThis, "fetch", async () => Response.json({elements: [{type: "node", id: 811, lat: 15.3144, lon: 74.3143, tags: {name: "Fixture Museum", tourism: "museum"}}]}));
  const result = await loadPlaceNearby({name: "Dudhsagar Waterfalls", lat: 15.3144, lng: 74.3143});
  assert.ok(result);
  assert.equal(result.osmCount, 1);
  assert.ok(result.curatedCount > 0);
  const places = [...result.eat, ...result.activities, ...result.sights];
  assert.ok(places.some(place => place.name === "Dudhsagar Waterfalls"));
  assert.ok(places.some(place => place.name === "Fixture Museum"));
  assert.ok(places.every(place => place.distanceKm <= 5));
});
