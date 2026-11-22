import test from "node:test";
import assert from "node:assert/strict";
import { distanceBearing, walkingDirections } from "../../frontend/src/lib/companion-tracking.ts";
test("distance and cardinal bearing work in every quadrant and at zero coordinates", () => {
  const origin = { lat: 0, lng: 0 };
  assert.equal(distanceBearing(origin, origin).metres, 0);
  assert.equal(distanceBearing(origin, { lat: 1, lng: 0 }).cardinal, "N");
  assert.equal(distanceBearing(origin, { lat: -1, lng: 0 }).cardinal, "S");
  assert.equal(distanceBearing(origin, { lat: 0, lng: 1 }).cardinal, "E");
  assert.equal(distanceBearing(origin, { lat: 0, lng: -1 }).cardinal, "W");
  assert.ok(Math.abs(distanceBearing(origin, { lat: 1, lng: 0 }).metres - 111195) < 2);
  assert.match(walkingDirections(origin), /destination=0,0&travelmode=walking/);
});
