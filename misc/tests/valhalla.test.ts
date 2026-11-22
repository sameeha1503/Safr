import { test } from "node:test";
import assert from "node:assert/strict";
import {
  areRoutesDuplicate,
  decodePolyline6,
  mapValhallaManeuverType,
  mapValhallaManeuverModifier,
} from "../../frontend/src/lib/valhalla.server.ts";
import { assessRoadConditions } from "../../frontend/src/lib/route-comparison.ts";
import { computeSafeRoutes } from "../../frontend/src/lib/maps.server.ts";

test("decodePolyline6 correctly decodes coordinates with 6 decimal places", () => {
  // (15.498900, 73.827800) to (15.499500, 73.828500)
  const encoded = "gh~p\\o|aykCod@wj@";
  const coords = decodePolyline6(encoded);
  assert.equal(coords.length, 2);
  const [lng0, lat0] = coords[0]!;
  assert.ok(Math.abs(lat0 - 15.4989) < 0.00001);
  assert.ok(Math.abs(lng0 - 73.8278) < 0.00001);
  const [lng1, lat1] = coords[1]!;
  assert.ok(Math.abs(lat1 - 15.4995) < 0.00001);
  assert.ok(Math.abs(lng1 - 73.8285) < 0.00001);
});

test("decodePolyline6 handles empty string cleanly", () => {
  const coords = decodePolyline6("");
  assert.deepEqual(coords, []);
});

test("mapValhallaManeuverType correctly maps maneuver types", () => {
  assert.equal(mapValhallaManeuverType(1), "depart");
  assert.equal(mapValhallaManeuverType(4), "arrive");
  assert.equal(mapValhallaManeuverType(10), "turn");
  assert.equal(mapValhallaManeuverType(26), "roundabout");
  assert.equal(mapValhallaManeuverType(8), "continue");
  assert.equal(mapValhallaManeuverType(999), "continue");
});

test("mapValhallaManeuverModifier correctly maps directional modifiers", () => {
  assert.equal(mapValhallaManeuverModifier(9), "slight-right");
  assert.equal(mapValhallaManeuverModifier(10), "right");
  assert.equal(mapValhallaManeuverModifier(11), "sharp-right");
  assert.equal(mapValhallaManeuverModifier(14), "sharp-left");
  assert.equal(mapValhallaManeuverModifier(15), "left");
  assert.equal(mapValhallaManeuverModifier(16), "slight-left");
  assert.equal(mapValhallaManeuverModifier(8), undefined);
});

test("assessRoadConditions handles Valhalla wayIds matching Overpass ways", () => {
  const legs = [
    {
      annotation: {
        wayIds: [1001, 1002],
        distance: [150, 250],
      },
    },
  ];
  const ways = [
    { id: 1001, nodes: [1, 2], tags: { surface: "asphalt", lit: "yes", maxspeed: "50" } },
    { id: 1002, nodes: [2, 3], tags: { surface: "asphalt", lit: "yes", maxspeed: "50" } },
  ];

  const evidence = assessRoadConditions(legs, ways, false);
  assert.equal(evidence.sufficient, true);
  assert.equal(evidence.coveragePercent, 100);
  assert.equal(evidence.conditionCoveragePercent, 100);
  assert.equal(evidence.mappedRiskExposure, 0);
});

test("assessRoadConditions with wayIds penalizes unlit roads at night", () => {
  const legs = [
    {
      annotation: {
        wayIds: [1001],
        distance: [1000],
      },
    },
  ];
  const ways = [
    { id: 1001, nodes: [1, 2], tags: { surface: "asphalt", lit: "no", maxspeed: "50" } },
  ];

  const day = assessRoadConditions(legs, ways, false);
  const night = assessRoadConditions(legs, ways, true);
  assert.equal(day.sufficient, true);
  assert.equal(night.sufficient, true);
  assert.ok(night.mappedRiskExposure! > day.mappedRiskExposure!);
  assert.equal(night.mappedRiskExposure, 3.0); // 1000m * 3 / 1000
});

test("computeSafeRoutes falls back to OSRM when Valhalla fails", async (t) => {
  const prevProvider = process.env["ROUTING_PROVIDER"];
  const prevValhallaUrl = process.env["VALHALLA_BASE_URL"];

  process.env["ROUTING_PROVIDER"] = "valhalla";
  process.env["VALHALLA_BASE_URL"] = "http://127.0.0.1:1"; // Invalid endpoint that will fail to connect

  t.after(() => {
    if (prevProvider == null) delete process.env["ROUTING_PROVIDER"];
    else process.env["ROUTING_PROVIDER"] = prevProvider;
    if (prevValhallaUrl == null) delete process.env["VALHALLA_BASE_URL"];
    else process.env["VALHALLA_BASE_URL"] = prevValhallaUrl;
  });

  const osrmRoute = {
    distance: 5000,
    duration: 600,
    geometry: {
      coordinates: [
        [73.8, 15.4],
        [73.81, 15.41],
      ],
    },
    legs: [
      {
        summary: "OSRM Backup Route",
        steps: [
          {
            name: "Main Rd",
            distance: 5000,
            duration: 600,
            maneuver: { type: "depart", location: [73.8, 15.4] },
          },
        ],
        annotation: { nodes: [1, 2], distance: [5000] },
      },
    ],
  };

  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (String(url).includes(":1/route")) {
      throw new Error("Connection refused");
    }
    if (String(url).includes("/route/v1/driving")) {
      return Response.json({
        code: "Ok",
        routes: [osrmRoute],
        waypoints: [{ distance: 10 }, { distance: 20 }],
      });
    }
    // Overpass mock
    return Response.json({ elements: [] });
  });

  const routes = await computeSafeRoutes(
    { lat: 15.4, lng: 73.8 },
    { lat: 15.41, lng: 73.81 },
    false,
  );

  assert.equal(routes.length, 1);
  assert.equal(routes[0]!.distanceMeters, 5000);
  assert.equal(routes[0]!.summary, "OSRM Backup Route");
});

test("areRoutesDuplicate identifies duplicate and distinct routes correctly", () => {
  const coordsA: [number, number][] = [
    [73.8, 15.4],
    [73.81, 15.41],
    [73.82, 15.42],
  ];
  // 1. Identical coordinates
  assert.equal(areRoutesDuplicate(coordsA, 1000, 100, coordsA, 1000, 100), true);

  // 2. Distance and duration differing by < 1%
  assert.equal(
    areRoutesDuplicate(coordsA, 1000, 100, [[73.8, 15.4], [73.85, 15.45]], 1005, 100.5),
    true,
  );

  // 3. Sharing >= 95% points
  const points20: [number, number][] = Array.from({ length: 20 }, (_, i) => [
    73.8 + i * 0.001,
    15.4 + i * 0.001,
  ]);
  const points19Shared: [number, number][] = [
    ...points20.slice(0, 19),
    [73.999, 15.999], // 1 different point out of 20 (95% shared)
  ];
  assert.equal(
    areRoutesDuplicate(points20, 2000, 200, points19Shared, 2500, 250),
    true,
  );

  // 4. Distinct routes
  const coordsB: [number, number][] = [
    [73.5, 15.1],
    [73.6, 15.2],
  ];
  assert.equal(areRoutesDuplicate(coordsA, 1000, 100, coordsB, 1500, 180), false);
});

