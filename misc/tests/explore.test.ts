import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlaceName } from "../../frontend/src/lib/place-names.ts";
import { placeInsightsSchema } from "../../frontend/src/lib/goa-schemas.ts";

test("place names normalize descriptors, whitespace and diacritics only for comparison", () => {
  assert.equal(normalizePlaceName(" BÁGA  Beach "), "baga");
  assert.equal(normalizePlaceName("Fort Aguada"), normalizePlaceName("Aguada Fort"));
  assert.notEqual(normalizePlaceName("Colva Beach"), normalizePlaceName("Baga Beach"));
  assert.equal(normalizePlaceName("Church"), "church");
});
test("place insights require resolved coordinates and accept missing optional sections", () => {
  const payload = { place: "Baga", location: { name: "Baga", lat: 15.55, lng: 73.75, state: "Goa" }, summary: "Baga", eat: [], activities: [], sights: [] };
  assert.equal(placeInsightsSchema.parse(payload).location.lat, 15.55);
  assert.equal(placeInsightsSchema.safeParse({ ...payload, location: undefined }).success, false);
});
