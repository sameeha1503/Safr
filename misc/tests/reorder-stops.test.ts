import assert from "node:assert/strict";
import test from "node:test";
import { reorderStops } from "../../frontend/src/lib/reorder-stops.ts";

test("reordering stops preserves other stops and leaves the input untouched", () => {
  const stops = Object.freeze(["Panaji", "Baga", "Chapora", "Mapusa"]);
  assert.deepEqual(reorderStops(stops, 0, 2), ["Baga", "Chapora", "Panaji", "Mapusa"]);
  assert.deepEqual(reorderStops(stops, 3, 1), ["Panaji", "Mapusa", "Baga", "Chapora"]);
  assert.deepEqual(stops, ["Panaji", "Baga", "Chapora", "Mapusa"]);
});

test("invalid or cancelled stop drops preserve the itinerary", () => {
  const stops = ["Panaji", "Baga"];
  for (const [from, to] of [[-1, 0], [0, 2], [NaN, 0], [0, 0.5], [1, 1]]) {
    assert.deepEqual(reorderStops(stops, from!, to!), stops);
  }
  assert.deepEqual(reorderStops([], 0, 1), []);
});
