import test from "node:test";
import assert from "node:assert/strict";
import { buildItinerary } from "../../frontend/src/lib/travel.server.ts";
import { distanceKm } from "../../frontend/src/lib/geo.ts";

const PANJIM_COORD = { lat: 15.4989, lng: 73.8278, name: "Panjim" };
const PALOLEM_COORD = { lat: 15.01, lng: 74.0232 };
const OLD_GOA_COORD = { lat: 15.5009, lng: 73.9116 };
const ANJUNA_COORD = { lat: 15.5847, lng: 73.7438 };
const COLVA_COORD = { lat: 15.2757, lng: 73.9137 };

function mockFetchHandler(url: string | URL | Request): Promise<Response> {
  const urlStr = String(url);

  // Overpass throws
  if (urlStr.includes("overpass") || urlStr.includes("interpreter")) {
    return Promise.reject(new Error("Overpass connection timed out"));
  }

  // Photon geocoding mock
  if (urlStr.includes("photon.komoot.io")) {
    const decoded = decodeURIComponent(urlStr).toLowerCase();
    let name = "Place";
    let lat = 15.4989;
    let lng = 73.8278;

    if (decoded.includes("palolem")) {
      name = "Palolem Beach";
      lat = PALOLEM_COORD.lat;
      lng = PALOLEM_COORD.lng;
    } else if (decoded.includes("old goa")) {
      name = "Old Goa";
      lat = OLD_GOA_COORD.lat;
      lng = OLD_GOA_COORD.lng;
    } else if (decoded.includes("panjim")) {
      name = "Panjim";
      lat = PANJIM_COORD.lat;
      lng = PANJIM_COORD.lng;
    } else if (decoded.includes("anjuna")) {
      name = "Anjuna Beach";
      lat = ANJUNA_COORD.lat;
      lng = ANJUNA_COORD.lng;
    } else if (decoded.includes("colva")) {
      name = "Colva Beach";
      lat = COLVA_COORD.lat;
      lng = COLVA_COORD.lng;
    }

    return Promise.resolve(
      Response.json({
        features: [
          {
            properties: {
              osm_id: 1,
              osm_type: "node",
              name,
              state: "Goa",
              countrycode: "in",
            },
            geometry: { coordinates: [lng, lat] },
          },
        ],
      }),
    );
  }

  // OSRM /table/ mock
  if (urlStr.includes("/table/")) {
    const match = urlStr.match(/driving\/([^?]+)/);
    if (match) {
      const coords = match[1].split(";").map((pair) => {
        const [lng, lat] = pair.split(",").map(Number);
        return { lat, lng };
      });
      const count = coords.length;
      const durations: number[][] = [];
      const distances: number[][] = [];
      for (let i = 0; i < count; i++) {
        durations[i] = [];
        distances[i] = [];
        for (let j = 0; j < count; j++) {
          if (i === j) {
            durations[i]![j] = 0;
            distances[i]![j] = 0;
          } else {
            const dMeters = distanceKm(coords[i]!, coords[j]!) * 1000;
            distances[i]![j] = dMeters;
            durations[i]![j] = Math.max(30, Math.round(dMeters / 9.72));
          }
        }
      }
      return Promise.resolve(
        Response.json({
          code: "Ok",
          durations,
          distances,
          sources: Array.from({ length: count }, () => ({ distance: 20 })),
        }),
      );
    }
  }

  return Promise.resolve(Response.json({}));
}

test("destination resolution: typed place with start location gives journey mode around typed destination (not start)", async (t) => {
  t.mock.method(globalThis, "fetch", mockFetchHandler);

  // 1. Palolem Beach with start = Panjim
  const planPalolem = await buildItinerary({
    place: "Palolem Beach",
    state: "Goa",
    start: PANJIM_COORD,
    destination: undefined,
    origin: undefined,
    hours: 8,
    startTime: "09:00",
    date: "2026-11-25",
    pace: "balanced",
    interests: ["Local food", "Beaches & sunsets"],
    returnToStart: false,
  });

  assert.equal(
    planPalolem.mode,
    "journey",
    "Expected mode 'journey' when start is Panjim and place is Palolem Beach",
  );

  const nonEnRoutePalolem = planPalolem.stops.filter(
    (s) => s.slot !== "en-route",
  );
  assert.ok(
    nonEnRoutePalolem.length > 0,
    "Expected non-en-route stops in Palolem itinerary",
  );

  for (const stop of nonEnRoutePalolem) {
    assert.ok(
      stop.lat !== undefined && stop.lng !== undefined,
      `Stop "${stop.title}" must have lat/lng`,
    );
    const d = distanceKm({ lat: stop.lat, lng: stop.lng }, PALOLEM_COORD);
    assert.ok(
      d <= 10,
      `Stop "${stop.title}" is ${d.toFixed(1)} km from Palolem, expected <= 10 km`,
    );
  }

  // 2. Old Goa with start = Panjim
  const planOldGoa = await buildItinerary({
    place: "Old Goa",
    state: "Goa",
    start: PANJIM_COORD,
    destination: undefined,
    origin: undefined,
    hours: 8,
    startTime: "09:00",
    date: "2026-11-25",
    pace: "balanced",
    interests: ["History & heritage", "Local food"],
    returnToStart: false,
  });

  const nonEnRouteOldGoa = planOldGoa.stops.filter(
    (s) => s.slot !== "en-route",
  );
  assert.ok(
    nonEnRouteOldGoa.length > 0,
    "Expected non-en-route stops in Old Goa itinerary",
  );

  for (const stop of nonEnRouteOldGoa) {
    assert.ok(
      stop.lat !== undefined && stop.lng !== undefined,
      `Stop "${stop.title}" must have lat/lng`,
    );
    const d = distanceKm({ lat: stop.lat, lng: stop.lng }, OLD_GOA_COORD);
    assert.ok(
      d <= 10,
      `Stop "${stop.title}" is ${d.toFixed(1)} km from Old Goa, expected <= 10 km`,
    );
  }

  // Stop-title lists must differ between Palolem Beach and Old Goa
  const palolemTitles = planPalolem.stops.map((s) => s.title);
  const oldGoaTitles = planOldGoa.stops.map((s) => s.title);
  assert.notDeepEqual(
    palolemTitles,
    oldGoaTitles,
    "Palolem and Old Goa itineraries must have different stop titles",
  );
});

test("typed-only (no start) for Palolem Beach, Anjuna Beach, Old Goa and Colva Beach give four different arrival stops", async (t) => {
  t.mock.method(globalThis, "fetch", mockFetchHandler);

  const testPlaces = [
    "Palolem Beach",
    "Anjuna Beach",
    "Old Goa",
    "Colva Beach",
  ];
  const arrivalStops: Array<{ place: string; stopTitle: string; id?: string }> =
    [];

  for (const place of testPlaces) {
    const plan = await buildItinerary({
      place,
      state: "Goa",
      hours: 6,
      startTime: "09:00",
      date: "2026-11-25",
      pace: "balanced",
      interests: ["Local food", "Beaches & sunsets", "History & heritage"],
      returnToStart: false,
    });

    const arriveStop = plan.stops.find((s) => s.slot === "arrive");
    assert.ok(arriveStop, `Plan for "${place}" must have an arrive stop`);
    arrivalStops.push({
      place,
      stopTitle: arriveStop.title,
      id: arriveStop.id,
    });
  }

  const arrivalTitles = arrivalStops.map((s) => s.stopTitle);
  const uniqueTitles = new Set(arrivalTitles);
  assert.equal(
    uniqueTitles.size,
    4,
    `Expected 4 different arrival stops, got: ${JSON.stringify(arrivalStops)}`,
  );
});
