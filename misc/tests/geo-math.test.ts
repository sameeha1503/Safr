import test from "node:test";
import assert from "node:assert/strict";
import {
  metersPerPixel,
  normalizeHeading,
  angleDelta,
  smoothAngle,
  haversineDistanceMeters,
} from "../../frontend/src/features/map/lib/geo-math";

test("geo-math: normalizeHeading wraps correctly", () => {
  assert.equal(normalizeHeading(0), 0);
  assert.equal(normalizeHeading(360), 0);
  assert.equal(normalizeHeading(720), 0);
  assert.equal(normalizeHeading(45), 45);
  assert.equal(normalizeHeading(-90), 270);
  assert.equal(normalizeHeading(-370), 350);
});

test("geo-math: angleDelta computes signed shortest path", () => {
  assert.equal(angleDelta(0, 90), 90);
  assert.equal(angleDelta(90, 0), -90);
  assert.equal(angleDelta(350, 10), 20);
  assert.equal(angleDelta(10, 350), -20);
  assert.equal(Math.abs(angleDelta(180, 0)), 180);
  assert.equal(Math.abs(angleDelta(0, 180)), 180);
});

test("geo-math: smoothAngle interpolates across 0/360 boundary", () => {
  // From 350 to 10 across 0 boundary with alpha 0.5 should be 0
  const mid = smoothAngle(350, 10, 0.5);
  assert.equal(mid, 0);

  // From 10 to 350 with alpha 0.5 should be 0
  const midRev = smoothAngle(10, 350, 0.5);
  assert.equal(midRev, 0);

  // alpha = 0 returns prev
  assert.equal(smoothAngle(100, 200, 0), 100);

  // alpha = 1 returns next
  assert.equal(smoothAngle(100, 200, 1), 200);

  // quarter step
  assert.equal(smoothAngle(0, 40, 0.25), 10);
});

test("geo-math: metersPerPixel matches MapLibre 512px formula", () => {
  // At equator (lat 0), zoom 0: ~78271.5 m/px
  const eqZ0 = metersPerPixel(0, 0);
  assert.ok(Math.abs(eqZ0 - 78271.51696) < 0.01);

  // At zoom 1, mpp is halved
  const eqZ1 = metersPerPixel(0, 1);
  assert.ok(Math.abs(eqZ1 - 78271.51696 / 2) < 0.01);

  // In Goa (~15.5 deg), zoom 15:
  const goaZ15 = metersPerPixel(15.4989, 15);
  assert.ok(goaZ15 > 2.0 && goaZ15 < 2.5);
});

test("geo-math: haversineDistanceMeters calculates accurate distance", () => {
  // Panjim to Baga is ~15-16 km
  const dist = haversineDistanceMeters(15.4989, 73.8278, 15.5553, 73.7517);
  assert.ok(dist > 10000 && dist < 20000);

  // Same point is 0
  assert.equal(haversineDistanceMeters(15.4989, 73.8278, 15.4989, 73.8278), 0);
});
