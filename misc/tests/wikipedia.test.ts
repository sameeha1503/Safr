import test from "node:test";
import assert from "node:assert/strict";
import { titleMatchScore, trimExtract } from "../../frontend/src/lib/wikipedia-match.ts";
import { matchCuratedPlace } from "../../frontend/src/lib/curated-match.ts";
import { CURATED_GOA_PLACES } from "../../frontend/src/lib/goa-places-data.ts";
import { lookupWikipedia } from "../../frontend/src/lib/wikipedia.server.ts";

test("Wikipedia titles require significant name overlap", () => {
  assert.equal(titleMatchScore("Chapora Fort", "Chapora"), 1);
  assert.equal(titleMatchScore("Sé Cathedral", "Se Cathedral"), 1);
  assert.equal(titleMatchScore("Baga", "Goa"), 0);
  assert.equal(titleMatchScore("Baga Beach", "Baga, Goa"), 1);
  assert.equal(titleMatchScore("Baga Beach", "Baga Creek"), 0.5);
  assert.equal(titleMatchScore("", "Goa"), 0);
});
test("extract trims at complete sentence boundaries", () => {
  assert.equal(trimExtract("One. Two! Three? Four."), "One. Two! Three?");
  assert.equal(trimExtract("Short sentence. This is a longer sentence.", 20), "Short sentence.");
  assert.equal(trimExtract("No sentence boundary"), "");
  assert.equal(trimExtract("a".repeat(451) + "."), "");
});
test("curated match uses proximity and prefers matching names", () => {
  assert.equal(matchCuratedPlace("Chapora", 15.6059, 73.7388, CURATED_GOA_PLACES)?.name, "Chapora Fort");
  assert.equal(matchCuratedPlace("Chapora Fort", 14, 74, CURATED_GOA_PLACES), null);
  assert.equal(matchCuratedPlace("Nearby landmark", 15.6059, 73.7388, CURATED_GOA_PLACES)?.name, "Chapora Fort");
});
test("Wikipedia fixture returns matching article and credits with timeout-bound fetch", async t => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push(String(url));
    assert.ok(init.signal);
    return Response.json(String(url).includes("geosearch") ? { query: { geosearch: [
      { title: "Unrelated Museum", lat: 15.6, lon: 73.7, dist: 10 },
      { title: "Chapora Fort", lat: 15.6, lon: 73.7, dist: 100 },
    ] } } : { title: "Chapora Fort", extract: "A fort in Goa. It overlooks the river.", thumbnail: { source: "https://upload.wikimedia.org/test.jpg" }, content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Chapora_Fort" } } });
  });
  const article = await lookupWikipedia({ name: "Chapora", lat: 15.60591, lng: 73.73881 });
  assert.equal(article?.title, "Chapora Fort");
  assert.equal(article?.license, "CC BY-SA 4.0");
  assert.equal(calls.length, 2);
  await lookupWikipedia({ name: "Chapora", lat: 15.60591, lng: 73.73881 });
  assert.equal(calls.length, 2);
});
test("Wikipedia rejects unrelated nearby articles and HTTP errors without throwing", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ query: { geosearch: [{ title: "Museum", lat: 15, lon: 74, dist: 1 }] } });
  });
  assert.equal(await lookupWikipedia({ name: "Agonda", lat: 15.04, lng: 73.98 }), null);
  assert.equal(calls, 2);
  t.mock.method(globalThis, "fetch", async () => new Response("busy", { status: 503 }));
  assert.equal(await lookupWikipedia({ name: "Palolem", lat: 15.01, lng: 74.02 }), null);
});

test("exact article fallback requires a matching name and nearby coordinates", async t => {
  let coordinates: { lat: number; lon: number } | undefined = { lat: 14.999, lon: 74.023 };
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.ok(init.signal);
    return Response.json(String(url).includes("geosearch") ? { query: { geosearch: [] } } : {
      title: "Fixture Beach", extract: "A beach in Goa.", coordinates,
      thumbnail: { source: "https://upload.wikimedia.org/fixture-palolem.jpg" },
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Palolem_Beach" } },
    });
  });
  assert.ok((await lookupWikipedia({ name: "Fixture Beach", lat: 15.01, lng: 74.023 }))?.imageUrl);
  coordinates = { lat: 10, lon: 70 };
  assert.equal(await lookupWikipedia({ name: "Fixture Beach", lat: 15.011, lng: 74.023 }), null);
  coordinates = undefined;
  assert.equal(await lookupWikipedia({ name: "Fixture Beach", lat: 15.012, lng: 74.023 }), null);
});

test("disambiguation summaries never become place photos", async t => {
  t.mock.method(globalThis, "fetch", async (url: string) => Response.json(String(url).includes("geosearch") ? {
    query: { geosearch: [{ title: "Baga, Goa", lat: 15.55, lon: 73.75, dist: 10 }] },
  } : { type: "disambiguation", title: "Baga", extract: "Several places share this name.", content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Baga" } } }));
  assert.equal(await lookupWikipedia({ name: "Baga Beach", lat: 15.55, lng: 73.75 }), null);
});

test("reviewed Goa article mappings tolerate missing Wikipedia coordinates only near the known place", async t => {
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (String(url).includes("geosearch")) return new Response("rate limited", { status: 429 });
    return Response.json({ title: "Arambol", extract: "Arambol is a village in North Goa.",
      thumbnail: { source: "https://upload.wikimedia.org/fixture-arambol.jpg" },
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Arambol" } },
    });
  });
  assert.ok((await lookupWikipedia({ name: "Arambol Beach", lat: 15.6869, lng: 73.7042 }))?.imageUrl);
  assert.equal(await lookupWikipedia({ name: "Arambol Beach", lat: 16, lng: 74 }), null);
});
test("parallel Wikipedia requests share a single matched lookup", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls++;
    return Response.json(String(url).includes("geosearch") ? {query: {geosearch: [{title: "Se Cathedral", lat: 15.5, lon: 73.9, dist: 1}]}} : {title: "Se Cathedral", extract: "A cathedral in Goa.", content_urls: {desktop: {page: "https://en.wikipedia.org/wiki/Se_Cathedral"}}});
  });
  const place = {name: "Se Cathedral", lat: 15.50099, lng: 73.90099};
  const [a, b] = await Promise.all([lookupWikipedia(place), lookupWikipedia(place)]);
  assert.deepEqual(a, b);
  assert.equal(calls, 2);
});
