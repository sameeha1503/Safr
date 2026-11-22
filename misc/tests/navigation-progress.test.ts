import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptGpsSample,
  deriveNavigationProgress,
  parseRoutePolyline,
} from "../../frontend/src/features/map/lib/navigation-progress.ts";

const path = [
  { lat: 15.49, lng: 73.82 },
  { lat: 15.49, lng: 73.83 },
  { lat: 15.49, lng: 73.84 },
];

test("passing beyond the route endpoint does not imply arrival", () => {
  const result = deriveNavigationProgress({
    position: { lat: 15.49, lng: 73.85 },
    accuracyMeters: 8,
    path,
    steps: [],
    durationSeconds: 120,
  });
  assert.equal(result?.arrived, false);
  assert.equal(result?.offRoute, true);
});

test("invalid coordinates and out-of-order GPS samples are rejected", () => {
  assert.deepEqual(parseRoutePolyline("[[91,0],[0,181]]"), []);
  assert.equal(
    acceptGpsSample({
      previous: { ...path[0]!, timestamp: 2000, accuracy: 8 },
      next: { ...path[0]!, timestamp: 1000, accuracy: 8 },
    }),
    false,
  );
});

test("navigation progress snaps to route, advances instructions and detects arrival", () => {
  const steps = [
    {
      instruction: "Continue",
      distanceMeters: 1000,
      durationSeconds: 60,
      maneuverType: "continue",
      name: "Road",
      location: [15.49, 73.83] as [number, number],
    },
    {
      instruction: "Arrive",
      distanceMeters: 1000,
      durationSeconds: 60,
      maneuverType: "arrive",
      name: "Road",
      location: [15.49, 73.84] as [number, number],
    },
  ];
  const middle = deriveNavigationProgress({
    position: { lat: 15.49005, lng: 73.832 },
    accuracyMeters: 8,
    path,
    steps,
    durationSeconds: 120,
  });
  assert.ok(middle);
  assert.equal(middle.offRoute, false);
  assert.equal(middle.stepIndex, 1);
  assert.ok(middle.progress > 0.5);
  const arrived = deriveNavigationProgress({
    position: { lat: 15.49, lng: 73.84 },
    accuracyMeters: 8,
    path,
    steps,
    durationSeconds: 120,
  });
  assert.equal(arrived?.arrived, true);
});

test("navigation progress detects a genuine off-route position", () => {
  const value = deriveNavigationProgress({
    position: { lat: 15.495, lng: 73.83 },
    accuracyMeters: 10,
    path,
    steps: [],
    durationSeconds: 100,
  });
  assert.equal(value?.offRoute, true);
  assert.ok((value?.offRouteMeters ?? 0) > 400);
});

test("GPS filter rejects impossible jumps and malformed polylines", () => {
  assert.equal(parseRoutePolyline("not-json").length, 0);
  assert.equal(
    acceptGpsSample({
      previous: { ...path[0]!, timestamp: 0, accuracy: 10 },
      next: { lat: 16, lng: 74, timestamp: 1000, accuracy: 20 },
    }),
    false,
  );
  assert.equal(
    acceptGpsSample({ previous: null, next: { ...path[0]!, timestamp: 0, accuracy: 8 } }),
    true,
  );
});
