import assert from "node:assert/strict";
import test from "node:test";

import { itineraryMapHandoff, parseSavedItinerary } from "../../frontend/src/lib/itinerary-map.ts";
import type { Itinerary } from "../../frontend/src/lib/goa-schemas.ts";

function itinerary(stopCount = 3): Itinerary {
  return {
    title: "A day in Panaji",
    overview: "A mapped day.",
    tips: ["Carry water", "Check opening hours"],
    origin: { lat: 15.49, lng: 73.82 },
    stops: Array.from({ length: stopCount }, (_, index) => ({
      time: `${9 + index}:00`,
      title: `Stop ${index + 1}`,
      type: "sight" as const,
      duration: "1 hour",
      description: "A real stop",
      travel_note: "Drive using the mapped route",
      lat: 15.5 + index / 100,
      lng: 73.83 + index / 100,
    })),
  };
}

test("saved itinerary parsing rejects malformed database payloads", () => {
  assert.equal(parseSavedItinerary({ title: "Incomplete" }), null);
  assert.equal(parseSavedItinerary(itinerary())?.stops.length, 3);
});

test("itinerary handoff sends ordered intermediate stops to the map", () => {
  const handoff = itineraryMapHandoff(itinerary(), "Panaji");
  assert.ok(handoff);
  assert.equal(handoff.search.dest, "Stop 3");
  assert.equal(handoff.search.origin, "Panaji starting point");
  assert.deepEqual(JSON.parse(handoff.search.stops!), [
    { name: "Stop 1", lat: 15.5, lng: 73.83 },
    { name: "Stop 2", lat: 15.51, lng: 73.84 },
  ]);
});

test("return journeys finish at the itinerary origin and respect map limits", () => {
  const plan = itinerary(8);
  plan.returnMinutes = 25;
  const handoff = itineraryMapHandoff(plan, "Panaji");
  assert.ok(handoff);
  assert.equal(handoff.search.dest, "Panaji starting point");
  assert.equal(JSON.parse(handoff.search.stops!).length, 5);
  assert.equal(handoff.includedStopCount, 5);
  assert.equal(handoff.mappedStopCount, 8);
});

test("handoff uses the first mapped stop as origin for older saved plans", () => {
  const plan = itinerary();
  delete plan.origin;
  const handoff = itineraryMapHandoff(plan, "Panaji");
  assert.ok(handoff);
  assert.equal(handoff.search.origin, "Stop 1");
  assert.equal(handoff.search.dest, "Stop 3");
  assert.equal(JSON.parse(handoff.search.stops!).length, 1);
  assert.equal(handoff.includedStopCount, 3);
});

test("handoff in journey mode uses journey.start as origin and destination as end", () => {
  const plan = itinerary(3);
  plan.mode = "journey";
  plan.journey = {
    start: { lat: 15.49, lng: 73.82, name: "Panaji" },
    destination: { lat: 15.68, lng: 73.7, name: "Arambol Beach" },
    routeKm: 36,
    routeMin: 55,
  };
  const handoff = itineraryMapHandoff(plan, "Arambol Beach");
  assert.ok(handoff);
  assert.equal(handoff.search.origin, "Panaji");
  assert.equal(handoff.search.dest, "Arambol Beach");
  const waypoints = JSON.parse(handoff.search.stops!);
  assert.equal(waypoints.length, 3);
  assert.equal(waypoints[0].name, "Stop 1");
  assert.equal(handoff.includedStopCount, 3);
  assert.equal(handoff.mappedStopCount, 3);
});
