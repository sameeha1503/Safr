import test from "node:test";
import assert from "node:assert/strict";
import {
  computeBends,
  computeRouteCharacter,
  computeFewerRiskIndicators,
  SHARP_BEND_DEG,
  SHARP_BEND_WINDOW_M,
  HAIRPIN_DEG,
  HAIRPIN_WINDOW_M,
  JUNCTION_EXCLUDE_RADIUS_M,
  MIN_POINT_SPACING_M,
  type RouteCharacter,
} from "../../frontend/src/lib/route-character.ts";

test("route character thresholds are exported with expected defaults", () => {
  assert.equal(SHARP_BEND_DEG, 60);
  assert.equal(SHARP_BEND_WINDOW_M, 50);
  assert.equal(HAIRPIN_DEG, 120);
  assert.equal(HAIRPIN_WINDOW_M, 100);
  assert.equal(JUNCTION_EXCLUDE_RADIUS_M, 35);
  assert.equal(MIN_POINT_SPACING_M, 5);
});

test("a straight line gives 0 sharp bends and 0 hairpins", () => {
  const straightPoints = [
    { lat: 15.0, lng: 73.8 },
    { lat: 15.001, lng: 73.8 },
    { lat: 15.002, lng: 73.8 },
    { lat: 15.003, lng: 73.8 },
    { lat: 15.004, lng: 73.8 },
  ];
  const bends = computeBends(straightPoints, []);
  assert.equal(bends.sharpBends, 0);
  assert.equal(bends.hairpins, 0);
});

test("a tight zig-zag or hairpin shape gives at least 1 hairpin", () => {
  // North 111m, then turn around ~160 deg heading South-East, then turn around ~160 deg North-East
  const hairpinPoints = [
    { lat: 15.0, lng: 73.8 },
    { lat: 15.001, lng: 73.8 },
    { lat: 15.0003, lng: 73.8003 },
    { lat: 15.0012, lng: 73.8006 },
  ];
  const bends = computeBends(hairpinPoints, []);
  assert.ok(
    bends.hairpins >= 1,
    `Expected at least 1 hairpin, got ${bends.hairpins}`,
  );
});

test("a 90-degree corner with a step of maneuverType 'turn' at that spot gives 0 bends (junction exclusion) and 1 in junctionsPerKm", () => {
  const cornerPoints = [
    { lat: 15.0, lng: 73.8 },
    { lat: 15.001, lng: 73.8 }, // corner vertex (~111m from start)
    { lat: 15.001, lng: 73.801 }, // ~107m East
  ];

  // Without step, the 90-degree corner gives 1 sharp bend
  const withoutStep = computeBends(cornerPoints, []);
  assert.equal(withoutStep.sharpBends, 1);
  assert.equal(withoutStep.hairpins, 0);

  // With a "turn" maneuver at the corner spot:
  const cornerSteps = [
    {
      name: "Main Road",
      distanceMeters: 218,
      maneuverType: "turn",
      location: [15.001, 73.8] as [number, number],
    },
  ];
  const withStep = computeRouteCharacter({
    points: cornerPoints,
    steps: cornerSteps,
    routeDistanceMeters: 1000, // 1 km route -> 1 junction per km
    hazardZones: [],
  });

  assert.equal(
    withStep.sharpBends,
    0,
    "Corner bend should be excluded by junction",
  );
  assert.equal(withStep.hairpins, 0);
  assert.equal(
    withStep.junctionsPerKm,
    1.0,
    "1 turn step in 1 km route gives 1.0 junctions/km",
  );
});

test("a roundabout step at the spot excludes the bend", () => {
  const cornerPoints = [
    { lat: 15.0, lng: 73.8 },
    { lat: 15.001, lng: 73.8 },
    { lat: 15.001, lng: 73.801 },
  ];
  const roundaboutSteps = [
    {
      name: "Circle Road",
      distanceMeters: 218,
      maneuverType: "roundabout",
      location: [15.001, 73.8] as [number, number],
    },
  ];
  const char = computeRouteCharacter({
    points: cornerPoints,
    steps: roundaboutSteps,
    routeDistanceMeters: 1000,
    hazardZones: [],
  });
  assert.equal(char.sharpBends, 0, "Roundabout step excludes bend at that spot");
  assert.equal(char.hairpins, 0);
  assert.equal(char.junctionsPerKm, 1.0);
});

test("ghat: a step named 'Chorla Ghat Road' gives ghatKm > 0 and the name is listed", () => {
  const steps = [
    {
      name: "Chorla Ghat Road",
      distanceMeters: 4500,
      maneuverType: "continue",
      location: [15.5, 74.1] as [number, number],
    },
    {
      name: "Panaji Highway",
      distanceMeters: 5500,
      maneuverType: "continue",
      location: [15.5, 74.0] as [number, number],
    },
  ];
  const char = computeRouteCharacter({
    points: [
      { lat: 15.5, lng: 74.0 },
      { lat: 15.5, lng: 74.1 },
      { lat: 15.5, lng: 74.2 },
    ],
    steps,
    routeDistanceMeters: 10000,
    hazardZones: [],
  });
  assert.equal(char.ghatKm, 4.5);
  assert.deepEqual(char.ghatNames, ["Chorla Ghat Road"]);
});

test("pareto rule: route A better on bends and equal on the others gets the flag; route A better on bends but worse on zones gets no flag", () => {
  const baseChar: RouteCharacter = {
    sharpBends: 2,
    hairpins: 0,
    bendsPer10Km: 2.0,
    junctionsPerKm: 1.0,
    ghatKm: 0,
    ghatNames: [],
    accidentZones: 0,
    mainRoadKm: null,
  };

  // Case 1: Route A better on bends (1.0 vs 2.0) and equal on others
  const rA1 = { character: { ...baseChar, bendsPer10Km: 1.0 } };
  const rB1 = { character: { ...baseChar, bendsPer10Km: 2.0 } };
  const flags1 = computeFewerRiskIndicators([rA1, rB1], true);
  assert.deepEqual(flags1, [true, false]);

  // Case 2: Route A better on bends (1.0 vs 2.0) but worse on accidentZones (1 vs 0)
  const rA2 = {
    character: { ...baseChar, bendsPer10Km: 1.0, accidentZones: 1 },
  };
  const rB2 = {
    character: { ...baseChar, bendsPer10Km: 2.0, accidentZones: 0 },
  };
  const flags2 = computeFewerRiskIndicators([rA2, rB2], true);
  assert.deepEqual(flags2, [false, false]);

  // Case 3: When hazardDataAvailable is false, flag is false everywhere
  const flags3 = computeFewerRiskIndicators([rA1, rB1], false);
  assert.deepEqual(flags3, [false, false]);
});
