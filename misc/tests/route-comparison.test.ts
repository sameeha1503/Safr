import { test } from "node:test";
import assert from "node:assert/strict";
import { assessRoadConditions, routePreferences } from "../../frontend/src/lib/route-comparison.ts";
import { computeSafeRoutes } from "../../frontend/src/lib/maps.server.ts";
const legs = [{ annotation: { nodes: [1, 2, 3], distance: [100, 100] } }];
const paved = assessRoadConditions(
  legs,
  [{ nodes: [1, 2, 3], tags: { surface: "asphalt", lit: "yes", maxspeed: "40" } }],
  false,
);
const rough = assessRoadConditions(
  legs,
  [{ nodes: [1, 2, 3], tags: { surface: "gravel", lit: "no", maxspeed: "80" } }],
  false,
);

test("shortest and fastest compare unrounded meters and seconds independently", () => {
  const best = routePreferences([
    { distanceMeters: 1001, durationSeconds: 61, safety: paved },
    { distanceMeters: 1000, durationSeconds: 62, safety: rough },
  ]);
  assert.equal(best.fastest, 0);
  assert.equal(best.shortest, 1);
  assert.equal(best.safest, 0);
});
test("missing road tags never become a perfect safety score", () => {
  const unknown = assessRoadConditions(
    legs,
    [{ nodes: [1, 2, 3], tags: { highway: "residential" } }],
    false,
  );
  assert.equal(unknown.sufficient, false);
  assert.equal(unknown.mappedRiskExposure, null);
  assert.equal(
    routePreferences([
      { distanceMeters: 1, durationSeconds: 1, safety: paved },
      { distanceMeters: 2, durationSeconds: 2, safety: unknown },
    ]).safest,
    -1,
  );
});
test("night comparison allows estimate when lighting tags are incomplete but notes it in reasons", () => {
  const ways = [{ nodes: [1, 2, 3], tags: { surface: "asphalt" } }];
  const day = assessRoadConditions(legs, ways, false);
  const night = assessRoadConditions(legs, ways, true);
  assert.equal(day.sufficient, true);
  assert.equal(night.sufficient, true);
  assert.ok(
    night.reasons.some((r) =>
      r.includes("Lighting data is incomplete, so night-time lighting was not counted"),
    ),
  );
  assert.equal(night.mappedRiskExposure, day.mappedRiskExposure);
});
test("unrelated nearby roads cannot contribute safety evidence", () => {
  const evidence = assessRoadConditions(
    legs,
    [{ nodes: [4, 5, 6], tags: { surface: "asphalt", lit: "yes" } }],
    true,
  );
  assert.equal(evidence.coveragePercent, 0);
  assert.equal(evidence.sufficient, false);
});
test("missing annotations in any leg invalidate coverage-based ranking", () => {
  assert.equal(
    assessRoadConditions([...legs, {}], [{ nodes: [1, 2, 3], tags: { surface: "asphalt" } }], false)
      .sufficient,
    false,
  );
});
test("one route and tied safety evidence do not invent a safer winner", () => {
  const route = { distanceMeters: 100, durationSeconds: 10, safety: paved };
  assert.deepEqual(routePreferences([route]), { fastest: 0, shortest: 0, safest: -1 });
  assert.equal(routePreferences([route, route]).safest, -1);
});
test("safety compares total weighted exposure instead of diluting it with extra distance", () => {
  assert.ok(rough.mappedRiskExposure! > paved.mappedRiskExposure!);
  const twice = assessRoadConditions(
    [{ annotation: { nodes: [1, 2, 3], distance: [200, 200] } }],
    [{ nodes: [1, 2, 3], tags: { surface: "gravel", maxspeed: "80" } }],
    false,
  );
  assert.equal(twice.mappedRiskExposure, rough.mappedRiskExposure! * 2);
});
test("live-route adapter deduplicates geometry and retains route when safety service fails", async (t) => {
  const route = {
    distance: 1234,
    duration: 99,
    geometry: {
      coordinates: [
        [73.8, 15.4],
        [73.81, 15.41],
      ],
    },
    legs: [{ ...legs[0], steps: [] }],
  };
  t.mock.method(globalThis, "fetch", async (url: string) =>
    String(url).includes("/route/")
      ? Response.json({ routes: [route, route] })
      : new Response("busy", { status: 503 }),
  );
  const result = await computeSafeRoutes(
    { lat: 15.4, lng: 73.8 },
    { lat: 15.41, lng: 73.81 },
    false,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0]!.distanceMeters, 1234);
  assert.equal(result[0]!.isFastest, true);
  assert.equal(result[0]!.isShortest, true);
  assert.equal(result[0]!.isSafest, false);
  assert.equal(result[0]!.safety.sufficient, false);
});

test("routePreferences handles two routes where fastest and shortest are the same", () => {
  const best = routePreferences([
    { distanceMeters: 800, durationSeconds: 50, safety: paved },
    { distanceMeters: 1200, durationSeconds: 70, safety: rough },
  ]);
  assert.equal(best.fastest, 0);
  assert.equal(best.shortest, 0);
  assert.equal(best.safest, 0);
});

test("routePreferences requires sufficient safety data on all routes to identify a safest winner", () => {
  const insufficientSafety = { ...paved, sufficient: false, mappedRiskExposure: null };
  const best = routePreferences([
    { distanceMeters: 800, durationSeconds: 50, safety: paved },
    { distanceMeters: 1200, durationSeconds: 70, safety: insufficientSafety },
  ]);
  assert.equal(best.fastest, 0);
  assert.equal(best.shortest, 0);
  assert.equal(best.safest, -1);
});

test("road class tags apply lower penalty for standard roads and higher penalty for minor/unclassified", () => {
  const standardRoad = assessRoadConditions(
    legs,
    [{ nodes: [1, 2, 3], tags: { surface: "asphalt", highway: "primary" } }],
    false,
  );
  const minorRoad = assessRoadConditions(
    legs,
    [{ nodes: [1, 2, 3], tags: { surface: "asphalt", highway: "track" } }],
    false,
  );
  assert.equal(standardRoad.sufficient, true);
  assert.equal(minorRoad.sufficient, true);
  assert.ok(minorRoad.mappedRiskExposure! > standardRoad.mappedRiskExposure!);
});

