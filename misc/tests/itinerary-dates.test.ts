import test from "node:test";
import assert from "node:assert/strict";
import { itineraryDate } from "../../frontend/src/lib/itinerary-dates.ts";

test("itinerary dates use Goa's calendar even across UTC midnight", () => {
  const now = new Date("2026-10-11T20:00:00Z");
  assert.equal(itineraryDate("today", now), "2026-10-12");
  assert.equal(itineraryDate("tomorrow", now), "2026-10-13");
  assert.equal(itineraryDate("weekend", now), "2026-10-17");
});
test("weekend keeps the current Saturday or Sunday and tomorrow crosses the year", () => {
  assert.equal(itineraryDate("weekend", new Date("2026-10-10T06:00:00Z")), "2026-10-10");
  assert.equal(itineraryDate("weekend", new Date("2026-10-11T06:00:00Z")), "2026-10-11");
  assert.equal(itineraryDate("tomorrow", new Date("2026-12-31T06:00:00Z")), "2027-01-01");
});
