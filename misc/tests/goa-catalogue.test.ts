import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogueCategory,
  cataloguePickedPlace,
  filterCatalogue,
  safeWebsite,
} from "../../frontend/src/features/map/lib/goa-catalogue.ts";

const beach = { id: "way/1", lat: 15.5, lng: 73.8, tags: { name: "Test Beach", natural: "beach" } };
const cafe = {
  id: "node/2",
  lat: 15.4,
  lng: 73.9,
  tags: {
    name: "Test Café",
    amenity: "cafe",
    cuisine: "goan",
    "addr:city": "Panaji",
    website: "javascript:alert(1)",
  },
};
test("catalogue searches multiple words across location and cuisine while respecting filters", () => {
  assert.deepEqual(filterCatalogue([beach, cafe], "Food & drink", " PANAJI goan "), [cafe]);
  assert.deepEqual(filterCatalogue([beach, cafe], "Beaches", "goan"), []);
  assert.equal(catalogueCategory(beach), "Beaches");
});
test("catalogue keeps stable OSM identity and details for routing without remote lookup", () => {
  const selected = cataloguePickedPlace(cafe);
  assert.equal(selected.id, cafe.id);
  assert.equal(selected.lat, cafe.lat);
  assert.equal(selected.kindLabel, "Café");
  assert.equal(selected.catalogueDetails?.cuisine, "goan");
  assert.equal(selected.catalogueDetails?.website, undefined);
});
test("external website links accept only explicit web protocols", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,test", "file:///tmp/a", "invalid"])
    assert.equal(safeWebsite(value), undefined);
  assert.equal(safeWebsite("https://example.com"), "https://example.com/");
});
