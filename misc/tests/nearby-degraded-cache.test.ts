import test from "node:test";
import assert from "node:assert/strict";
import { nearbyPlaces } from "../../frontend/src/lib/places.server.ts";
import { CURATED_GOA_PLACES } from "../../frontend/src/lib/goa-places-data.ts";

// Use a coordinate with < 15 catalogue entries to exercise Overpass fallback
const center = { lat: 14.9, lng: 73.95 };

test("a failed Overpass lookup is not cached as the real answer", async (t) => {
  let overpassWorks = false;
  t.mock.method(globalThis, "fetch", async () => {
    if (!overpassWorks) throw new Error("offline");
    return Response.json({
      elements: [
        {
          type: "node",
          id: 987654,
          lat: center.lat + 0.001,
          lon: center.lng + 0.001,
          tags: { name: "Recovered Live Cafe", amenity: "cafe" },
        },
      ],
    });
  });
  t.mock.method(console, "warn", () => {});

  // Radius is unusual so this test never shares a cache key with another test.
  const degraded = await nearbyPlaces(center, 3.7);
  assert.ok(degraded.length > 0, "curated landmarks still serve as a fallback");
  assert.ok(!degraded.some((p) => p.name === "Recovered Live Cafe"));

  overpassWorks = true;
  const recovered = await nearbyPlaces(center, 3.7);
  assert.ok(
    recovered.some((p) => p.name === "Recovered Live Cafe"),
    "once Overpass recovers, live results must replace the degraded fallback",
  );
});

test("a successful lookup is still cached", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({
      elements: [
        {
          type: "node",
          id: 987655,
          lat: center.lat + 0.002,
          lon: center.lng + 0.002,
          tags: { name: "Cached Live Cafe", amenity: "cafe" },
        },
      ],
    });
  });
  await nearbyPlaces(center, 3.9);
  const first = calls;
  await nearbyPlaces(center, 3.9);
  assert.equal(calls, first, "second identical lookup is served from cache");
});

test("the Overpass query filters by selective tag first, not every named object", async (t) => {
  let sent = "";
  t.mock.method(globalThis, "fetch", async (url: string) => {
    sent = decodeURIComponent(new URL(url).searchParams.get("data") ?? "");
    return Response.json({ elements: [] });
  });
  await nearbyPlaces(center, 4.1);
  assert.match(sent, /nwr\["tourism"~"\^\(hotel\|/);
  assert.match(sent, /\["name"\]\(around:/);
  assert.doesNotMatch(sent, /->\.nearby/);
  assert.match(sent, /\[timeout:9\]/);
});
