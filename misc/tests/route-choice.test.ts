import test from "node:test";
import assert from "node:assert/strict";
import {
  explainRouteChoice,
  type ExplainableRoute,
} from "../../frontend/src/lib/route-choice.ts";

function route(over: Partial<ExplainableRoute> & { exposure?: Partial<NonNullable<ExplainableRoute["safety"]["exposure"]>> } = {}): ExplainableRoute {
  const { exposure, ...rest } = over;
  return {
    durationMin: 20,
    distanceKm: 10,
    isFastest: false,
    isSafest: false,
    hazardZones: [],
    safety: {
      coveragePercent: 95,
      conditionCoveragePercent: 90,
      lightingCoveragePercent: 80,
      mappedRiskExposure: 5,
      sufficient: true,
      reasons: [],
      exposure: { unpavedKm: 0, roughKm: 0, highSpeedKm: 0, minorRoadKm: 0, unlitKm: null, ...exposure },
    },
    ...rest,
  };
}

test("safer alternative explains the concrete differences and the time cost", () => {
  const fastest = route({ isFastest: true, durationMin: 18, distanceKm: 9, hazardZones: [{ id: "z1", label: "Zuari Bridge junction" }], exposure: { unpavedKm: 1.2, minorRoadKm: 2 } });
  const safer = route({ isSafest: true, durationMin: 24, distanceKm: 11.5, exposure: { unpavedKm: 0 } });
  const c = explainRouteChoice([fastest, safer], { isNight: false });
  assert.equal(c.verdict, "safer-alternative");
  assert.equal(c.extraMinutes, 6);
  assert.equal(c.extraKm, 2.5);
  assert.match(c.reasons.join(" "), /Avoids Zuari Bridge junction/);
  assert.match(c.reasons.join(" "), /1\.2 km less rough or unpaved/);
  assert.match(c.reasons.join(" "), /2\.0 km less on narrow/);
});

test("unlit road is only mentioned at night", () => {
  const fastest = route({ isFastest: true, exposure: { unlitKm: 3 } });
  const safer = route({ isSafest: true, exposure: { unlitKm: 0.5 } });
  const day = explainRouteChoice([fastest, safer], { isNight: false });
  const night = explainRouteChoice([fastest, safer], { isNight: true });
  assert.doesNotMatch(day.reasons.join(" "), /unlit/);
  assert.match(night.reasons.join(" "), /2\.5 km less on unlit/);
});

test("tiny differences are not presented as benefits", () => {
  const fastest = route({ isFastest: true, exposure: { unpavedKm: 0.1 } });
  const safer = route({ isSafest: true });
  const c = explainRouteChoice([fastest, safer], { isNight: false });
  assert.equal(c.reasons.length, 1);
  assert.match(c.reasons[0]!, /combined mapped road-risk/);
});

test("warns when the safer route still passes a known hazard zone", () => {
  const fastest = route({ isFastest: true });
  const safer = route({ isSafest: true, hazardZones: [{ id: "z2", label: "NH66 curve" }] });
  const c = explainRouteChoice([fastest, safer], { isNight: false });
  assert.match(c.reasons.join(" "), /still passes NH66 curve/);
  assert.deepEqual(c.hazardsOnRecommended, ["NH66 curve"]);
});

test("fastest that is also safest says so", () => {
  const both = route({ isFastest: true, isSafest: true });
  const other = route({ exposure: { roughKm: 2 } });
  const c = explainRouteChoice([both, other], { isNight: false });
  assert.equal(c.verdict, "fastest-is-safest");
  assert.match(c.reasons.join(" "), /2\.0 km more rough/);
});

test("insufficient data says why instead of inventing a winner", () => {
  const a = route({ isFastest: true });
  const b = route();
  b.safety.sufficient = false;
  b.safety.conditionCoveragePercent = 42;
  const c = explainRouteChoice([a, b], { isNight: false });
  assert.equal(c.verdict, "unclear");
  assert.equal(c.safer, null);
  assert.match(c.reasons[0]!, /42%/);
  assert.match(c.reasons[0]!, /not "safe"/);
});

test("single route still surfaces hazard zones", () => {
  const only = route({ isFastest: true, hazardZones: [{ id: "z3", label: "Mapusa market crossing" }] });
  const c = explainRouteChoice([only], { isNight: false });
  assert.equal(c.verdict, "unclear");
  assert.match(c.reasons.join(" "), /Only one road route/);
  assert.match(c.reasons.join(" "), /Mapusa market crossing/);
});

test("no routes yields an empty, unclear result", () => {
  const c = explainRouteChoice([], { isNight: false });
  assert.equal(c.verdict, "unclear");
  assert.equal(c.fastest, null);
});
