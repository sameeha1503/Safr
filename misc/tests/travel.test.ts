import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleItinerary, formatPlanTime } from "../../frontend/src/lib/itinerary-planner.ts";
import { validateAge } from "../../frontend/src/lib/age-validation.ts";
import { validatePhone } from "../../frontend/src/lib/phone-validation.ts";
import { distanceToRoute } from "../../frontend/src/lib/geo.ts";
import { itineraryInputSchema } from "../../frontend/src/lib/travel-schemas.ts";
import type { NearbyPlace } from "../../frontend/src/lib/geo.ts";

const candidates: NearbyPlace[] = Array.from({ length: 12 }, (_, i) => ({
  id: `node/${i}`,
  name: `Place ${i}`,
  lat: 15 + i / 100,
  lng: 74,
  category: "attraction",
  kind: "museum",
  distanceKm: i,
  sourceUrl: `https://www.openstreetmap.org/node/${i}`,
}));
const base = {
  candidates,
  durations: Array.from({ length: 13 }, () => Array(13).fill(600)),
  distances: Array.from({ length: 13 }, () => Array(13).fill(5000)),
  reachable: Array(13).fill(true),
  hours: 6,
  startTime: "09:00",
  pace: "balanced" as const,
  returnToStart: false,
  preferredIds: candidates.map((p) => p.id),
};

test("all budgets and paces stay within time limit and include initial travel", () => {
  for (let hours = 1; hours <= 24; hours++)
    for (const pace of ["relaxed", "balanced", "packed"] as const)
      for (const returnToStart of [true, false]) {
        const plan = scheduleItinerary({ ...base, hours, pace, returnToStart });
        assert.ok(plan.totalMinutes <= hours * 60);
        assert.equal(plan.totalMinutes + plan.unusedMinutes, hours * 60);
        let previous = 540;
        for (const stop of plan.stops) {
          assert.equal(stop.arrivalMinute, previous + stop.transitMin);
          assert.equal(stop.departureMinute, stop.arrivalMinute + stop.durationMin);
          previous = stop.departureMinute;
        }
        assert.equal(new Set(plan.stops.map((s) => s.title)).size, plan.stops.length);
      }
});
test("one hour allows one realistic nearby stop", () => {
  const plan = scheduleItinerary({ ...base, hours: 1 });
  assert.equal(plan.stops.length, 1);
  assert.equal(plan.totalMinutes, 60);
  assert.equal(plan.stops[0]!.durationMin, 40);
});
test("unreachable legs and distant road snaps are never treated as zero travel", () => {
  const plan = scheduleItinerary({
    ...base,
    durations: Array.from({ length: 13 }, () => Array(13).fill(null)),
  });
  assert.equal(plan.stops.length, 0);
  assert.equal(scheduleItinerary({ ...base, reachable: Array(13).fill(false) }).stops.length, 0);
});
test("overnight times explicitly include the next day", () => {
  assert.equal(formatPlanTime(1470), "00:30 (+1 day)");
  assert.match(scheduleItinerary({ ...base, startTime: "23:30" }).stops[0]!.time, /\+1 day/);
});
test("route proximity measures segments, including their midpoints", () => {
  assert.ok(
    distanceToRoute({ lat: 15, lng: 74.5 }, [
      { lat: 15, lng: 74 },
      { lat: 15, lng: 75 },
    ]) < 0.001,
  );
  assert.ok(
    distanceToRoute({ lat: 16, lng: 74.5 }, [
      { lat: 15, lng: 74 },
      { lat: 15, lng: 75 },
    ]) > 100,
  );
});
test("age/category boundaries and invalid numeric inputs", () => {
  for (const [age, category] of [
    ["0", "kid"],
    ["17", "kid"],
    ["18", "adult"],
    ["59", "adult"],
    ["60", "senior"],
    ["120", "senior"],
  ])
    assert.equal(validateAge(age!, category!), null);
  for (const [age, category] of [
    ["18", "kid"],
    ["17", "adult"],
    ["60", "adult"],
    ["59", "senior"],
    ["-1", "kid"],
    ["3.5", "kid"],
    ["", "adult"],
    ["121", "senior"],
    ["1e1", "kid"],
  ])
    assert.ok(validateAge(age!, category!));
});
test("rejects invalid dates, times, coordinates and fractional hour budgets", () => {
  const valid = {
    place: "Panjim",
    interests: ["Local food"],
    pace: "balanced",
    hours: 2,
    date: "2026-09-19",
    startTime: "09:00",
  };
  for (const bad of [
    { startTime: "25:30" },
    { date: "2026-02-30" },
    { hours: 1.5 },
    { origin: { lat: 91, lng: 74 } },
    { interests: [] },
  ])
    assert.equal(itineraryInputSchema.safeParse({ ...valid, ...bad }).success, false);
});
test("phone number validation rules (required, digits only, sensible length)", () => {
  assert.equal(validatePhone("9876543210"), null);
  assert.equal(validatePhone("1234567"), null);
  assert.equal(validatePhone("123456789012345"), null);

  assert.ok(validatePhone(""));
  assert.ok(validatePhone("   "));
  assert.ok(validatePhone("abc"));
  assert.ok(validatePhone("12345a6789"));
  assert.ok(validatePhone("+123456789"));
  assert.ok(validatePhone("123456"));
  assert.ok(validatePhone("1234567890123456"));
});
