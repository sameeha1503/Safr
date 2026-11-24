import test from "node:test";
import assert from "node:assert/strict";
import {
  sunsetMinutes,
  isOpenAt,
  itineraryMode,
  scoreCandidate,
  findBestCluster,
  buildSlotPlan,
  planDay,
  humanizeKind,
  humanizeCuisine,
  cleanWhy,
} from "../../frontend/src/lib/itinerary-engine.ts";
import { itinerarySchema } from "../../frontend/src/lib/goa-schemas.ts";
import { nearbyPlacesWithMeta } from "../../frontend/src/lib/places.server.ts";
import { buildItinerary } from "../../frontend/src/lib/travel.server.ts";
import type { NearbyPlace } from "../../frontend/src/lib/geo.ts";
import { distanceKm } from "../../frontend/src/lib/geo.ts";

test("sunsetMinutes is within ±10 minutes of reality for Goa in January and May", () => {
  // Goa coords: ~15.5°N, ~73.8°E
  // January: roughly 18:15–18:40 (1095–1120 minutes)
  const janMinutes = sunsetMinutes("2026-01-15", 15.4989, 73.8278);
  assert.ok(
    janMinutes >= 1095 && janMinutes <= 1120,
    `Expected Jan sunset between 1095 and 1120 min, got ${janMinutes}`,
  );

  // May: roughly 18:50–19:15 (~19:15 range in May, 1130–1155 minutes)
  const mayMinutes = sunsetMinutes("2026-05-15", 15.4989, 73.8278);
  assert.ok(
    mayMinutes >= 1130 && mayMinutes <= 1155,
    `Expected May sunset between 1130 and 1155 min, got ${mayMinutes}`,
  );
});

test("isOpenAt evaluates standard hours, 24/7, split hours, and fails soft to unknown", () => {
  // Mo-Su 09:00-18:00: open at 10:00 (minute 600) and closed at 19:00 (minute 1140)
  assert.equal(isOpenAt("Mo-Su 09:00-18:00", "2026-11-24", 600), "open");
  assert.equal(isOpenAt("Mo-Su 09:00-18:00", "2026-11-24", 1140), "closed");

  // 24/7 is open
  assert.equal(isOpenAt("24/7", "2026-11-24", 600), "open");
  assert.equal(isOpenAt("24/7", "2026-11-24", 1320), "open");

  // Split hours: Mo-Sa 10:00-14:00,17:00-22:00 (2026-11-24 is a Tuesday)
  assert.equal(isOpenAt("Mo-Sa 10:00-14:00,17:00-22:00", "2026-11-24", 720), "open"); // 12:00
  assert.equal(isOpenAt("Mo-Sa 10:00-14:00,17:00-22:00", "2026-11-24", 900), "closed"); // 15:00
  assert.equal(isOpenAt("Mo-Sa 10:00-14:00,17:00-22:00", "2026-11-24", 1080), "open"); // 18:00

  // Sunday is closed under Mo-Sa rule (2026-11-29 is Sunday)
  assert.equal(isOpenAt("Mo-Sa 10:00-14:00,17:00-22:00", "2026-11-29", 720), "closed");

  // Hardened exotic rules, months, sunrise/sunset, and holiday modifiers -> "unknown"
  assert.equal(isOpenAt("Mo-Su 09:00-18:00; PH off", "2026-11-24", 600), "unknown");
  assert.equal(isOpenAt("sunrise-sunset", "2026-11-24", 600), "unknown");
  assert.equal(isOpenAt("Jun-Sep Mo-Fr 09:00-17:00", "2026-11-24", 600), "unknown");

  // Standard weekday-only rule checked on a Saturday (2026-11-28 is Saturday) -> "closed"
  assert.equal(isOpenAt("Mo-Fr 09:00-17:00", "2026-11-28", 600), "closed");

  // Garbage and missing -> "unknown"
  assert.equal(isOpenAt("not a valid time format", "2026-11-24", 600), "unknown");
  assert.equal(isOpenAt("", "2026-11-24", 600), "unknown");
  assert.equal(isOpenAt(undefined, "2026-11-24", 600), "unknown");

  // Verify same result regardless of server process.env.TZ
  const originalTz = process.env["TZ"];
  try {
    process.env["TZ"] = "UTC";
    const resUtc = isOpenAt("Mo-Su 09:00-18:00", "2026-11-24", 600);
    process.env["TZ"] = "Asia/Kolkata";
    const resIst = isOpenAt("Mo-Su 09:00-18:00", "2026-11-24", 600);
    assert.equal(resUtc, "open");
    assert.equal(resIst, "open");
    assert.equal(resUtc, resIst);
  } finally {
    if (originalTz != null) process.env["TZ"] = originalTz;
    else delete process.env["TZ"];
  }
});

test("a closed place is never scheduled; an unknown-hours place is scheduled and flagged", () => {
  const dest = { lat: 15.5, lng: 73.8, name: "Panaji" };
  const candidates: NearbyPlace[] = [
    {
      id: "node/1",
      name: "Closed Early Museum",
      lat: 15.501,
      lng: 73.801,
      category: "attraction",
      kind: "museum",
      openingHours: "Mo-Su 08:00-09:30", // Closes before arrival (start is 10:00)
      distanceKm: 0.5,
      sourceUrl: "https://example.com/1",
    },
    {
      id: "node/2",
      name: "Unknown Hours Fort",
      lat: 15.502,
      lng: 73.802,
      category: "attraction",
      kind: "fort",
      openingHours: undefined, // Unknown hours
      distanceKm: 0.6,
      sourceUrl: "https://example.com/2",
    },
    {
      id: "node/3",
      name: "Open All Day Gallery",
      lat: 15.503,
      lng: 73.803,
      category: "attraction",
      kind: "gallery",
      openingHours: "Mo-Su 09:00-19:00", // Open
      distanceKm: 0.7,
      sourceUrl: "https://example.com/3",
    },
  ];

  const plan = planDay({
    mode: "anchor",
    destination: dest,
    hours: 4,
    startTime: "10:00",
    pace: "balanced",
    interests: ["History & heritage"],
    destinationCandidates: candidates,
  });

  assert.ok(plan.stops.length > 0);
  assert.ok(
    !plan.stops.some((s) => s.title === "Closed Early Museum"),
    "Closed place must never be scheduled",
  );
  const unknownStop = plan.stops.find((s) => s.title === "Unknown Hours Fort");
  assert.ok(unknownStop, "Unknown-hours place should be scheduled when relevant");
  assert.equal(
    unknownStop.openStatus,
    "unknown",
    "Unknown-hours stop must be flagged as openStatus: unknown",
  );
});

test("no two consecutive meal stops, lunch lands in 12:00-14:30, and sunset stop arrives before sunset", () => {
  const dest = { lat: 15.5, lng: 73.8, name: "Panaji" };
  const candidates: NearbyPlace[] = [
    {
      id: "rest/1",
      name: "Cafe Bodega",
      lat: 15.501,
      lng: 73.801,
      category: "restaurant",
      kind: "cafe",
      cuisine: "Goan",
      openingHours: "24/7",
      distanceKm: 0.4,
      sourceUrl: "https://example.com/r1",
    },
    {
      id: "rest/2",
      name: "Fish Thali House",
      lat: 15.502,
      lng: 73.802,
      category: "restaurant",
      kind: "restaurant",
      cuisine: "Seafood",
      openingHours: "24/7",
      distanceKm: 0.5,
      sourceUrl: "https://example.com/r2",
    },
    {
      id: "sight/1",
      name: "Fontainhas Heritage Walk",
      lat: 15.503,
      lng: 73.803,
      category: "attraction",
      kind: "historic",
      openingHours: "24/7",
      distanceKm: 0.6,
      sourceUrl: "https://example.com/s1",
    },
    {
      id: "sunset/1",
      name: "Miramar Beach Sunset Point",
      lat: 15.485,
      lng: 73.805,
      category: "attraction",
      kind: "beach",
      bestTime: "sunset",
      openingHours: "24/7",
      distanceKm: 2.1,
      sourceUrl: "https://example.com/sunset",
    },
  ];

  // 10:00 to 19:00 (9 hours plan, covering lunch and sunset ~18:20)
  const plan = planDay({
    mode: "anchor",
    destination: dest,
    hours: 9,
    startTime: "10:00",
    pace: "balanced",
    interests: ["Local food", "Beaches & sunsets", "History & heritage"],
    destinationCandidates: candidates,
    date: "2026-11-24",
  });

  // Verify no two consecutive meals
  for (let i = 1; i < plan.stops.length; i++) {
    const prev = plan.stops[i - 1]!;
    const curr = plan.stops[i]!;
    assert.ok(
      !(prev.type === "food" && curr.type === "food"),
      `Consecutive food stops found at indices ${i - 1} and ${i}`,
    );
  }

  // Verify lunch window: 12:00-14:30 (720-870 minutes)
  const lunchStop = plan.stops.find((s) => s.slot === "meal" || s.type === "food");
  if (lunchStop) {
    assert.ok(
      lunchStop.arrivalMinute >= 700 && lunchStop.arrivalMinute <= 880,
      `Lunch arrived at minute ${lunchStop.arrivalMinute}, expected ~12:00-14:30`,
    );
  }

  // Verify sunset stop arrives before sunset
  const sunsetMin = sunsetMinutes("2026-11-24", dest.lat, dest.lng);
  const sunsetStop = plan.stops.find((s) => s.slot === "sunset" || s.type === "beach");
  if (sunsetStop) {
    assert.ok(
      sunsetStop.arrivalMinute < sunsetMin,
      `Sunset stop arrived at ${sunsetStop.arrivalMinute}, after sunset ${sunsetMin}`,
    );
  }
});

test("main-slot stops all lie within the cluster radius of each other", () => {
  const dest = { lat: 15.5, lng: 73.8 };
  // Cluster A: clustered in Panaji (< 1.5 km apart)
  // Candidate B: isolated far away in Margao (> 25 km away)
  const candidates: NearbyPlace[] = [
    {
      id: "a1",
      name: "Old Quarter Heritage",
      lat: 15.498,
      lng: 73.827,
      category: "attraction",
      kind: "monument",
      distanceKm: 0.2,
      sourceUrl: "https://example.com/a1",
    },
    {
      id: "a2",
      name: "Bishop Palace",
      lat: 15.495,
      lng: 73.824,
      category: "attraction",
      kind: "historic",
      distanceKm: 0.5,
      sourceUrl: "https://example.com/a2",
    },
    {
      id: "a3",
      name: "Church Square",
      lat: 15.5,
      lng: 73.826,
      category: "attraction",
      kind: "place_of_worship",
      distanceKm: 0.3,
      sourceUrl: "https://example.com/a3",
    },
    {
      id: "b1",
      name: "Distant Outlier Landmark",
      lat: 15.27,
      lng: 73.95, // ~30 km away
      category: "attraction",
      kind: "historic",
      distanceKm: 30,
      sourceUrl: "https://example.com/b1",
    },
  ];

  const bestCluster = findBestCluster(
    candidates,
    { interests: ["History & heritage"], center: dest },
    2.5,
  );
  assert.ok(bestCluster.length >= 2);
  assert.ok(!bestCluster.some((c) => c.id === "b1"), "Distant outlier must not be in cluster");

  for (let i = 0; i < bestCluster.length; i++) {
    for (let j = i + 1; j < bestCluster.length; j++) {
      const d = distanceKm(bestCluster[i]!, bestCluster[j]!);
      assert.ok(
        d <= 2.5,
        `Cluster items ${bestCluster[i]!.name} and ${bestCluster[j]!.name} are ${d} km apart (> 2.5 km)`,
      );
    }
  }
});

test("journey mode schedules en-route stop with detour <= 12 min within time budget", () => {
  const start = { lat: 15.498, lng: 73.827, name: "Panaji" };
  const dest = { lat: 15.605, lng: 73.738, name: "Vagator" }; // ~16 km away

  assert.equal(itineraryMode(start, dest), "journey");

  const corridorPlace: NearbyPlace = {
    id: "corr/1",
    name: "En Route Historic Fort",
    lat: 15.545,
    lng: 73.775,
    category: "attraction",
    kind: "fort",
    routeDistanceKm: 0.6, // 0.6 km off route -> detour ~2 min
    distanceKm: 8,
    sourceUrl: "https://example.com/corr1",
    openingHours: "24/7",
  };

  const destPlace: NearbyPlace = {
    id: "dest/1",
    name: "Vagator Hilltop",
    lat: 15.604,
    lng: 73.737,
    category: "attraction",
    kind: "viewpoint",
    distanceKm: 0.3,
    sourceUrl: "https://example.com/dest1",
    openingHours: "24/7",
  };

  const plan = planDay({
    mode: "journey",
    start,
    destination: dest,
    hours: 5, // 5 hours budget > 3 hours drive
    startTime: "09:00",
    pace: "balanced",
    interests: ["History & heritage", "Beaches & sunsets"],
    corridorCandidates: [corridorPlace],
    destinationCandidates: [destPlace],
    driveMinutesTotal: 40,
  });

  assert.ok(plan.stops.length >= 1);
  const enRouteStop = plan.stops.find((s) => s.slot === "en-route");
  assert.ok(enRouteStop, "Journey mode must schedule an en-route stop when available");
  assert.ok(
    (enRouteStop.detourMin ?? 0) <= 12,
    `En route detour minutes must be <= 12, got ${enRouteStop.detourMin}`,
  );
  assert.ok(plan.totalMinutes <= 5 * 60 + 30, "Total time must remain within time budget");
});

test("anchor mode (no start) produces valid plan and old saved itinerary passes schema", () => {
  const dest = { lat: 15.5, lng: 73.8, name: "Panaji" };
  assert.equal(itineraryMode(undefined, dest), "anchor");

  const candidates: NearbyPlace[] = [
    {
      id: "p1",
      name: "Old Church",
      lat: 15.501,
      lng: 73.801,
      category: "attraction",
      kind: "place_of_worship",
      distanceKm: 0.5,
      sourceUrl: "https://example.com/p1",
    },
  ];

  const plan = planDay({
    mode: "anchor",
    destination: dest,
    hours: 2,
    startTime: "10:00",
    pace: "balanced",
    interests: ["Churches & temples"],
    destinationCandidates: candidates,
  });

  assert.ok(plan.stops.length >= 1);

  // Validate an old saved itinerary format lacking all new fields (journey, mode, slot, why, etc.)
  const legacySavedItinerary = {
    title: "Panjim: your 4-hour plan",
    overview: "3 mapped stops in or near Panjim, Goa.",
    totalMinutes: 210,
    unusedMinutes: 30,
    returnMinutes: 0,
    endTime: "13:30",
    aiStatus: "used",
    routingSource: "OSRM",
    origin: { lat: 15.498, lng: 73.827 },
    stops: [
      {
        time: "10:00",
        title: "Old Church",
        type: "sight",
        duration: "50 min",
        durationMin: 50,
        arrivalMinute: 600,
        departureMinute: 650,
        description: "Historic church",
        travel_note: "5 min drive",
        lat: 15.501,
        lng: 73.801,
        distanceKm: 0.5,
      },
    ],
    tips: [
      "Driving times are OSRM estimates.",
      "Opening hours must be confirmed before travelling.",
    ],
  };

  const parsed = itinerarySchema.parse(legacySavedItinerary);
  assert.equal(parsed.title, "Panjim: your 4-hour plan");
  assert.equal(parsed.journey, undefined);
  assert.equal(parsed.mode, undefined);
  assert.equal(parsed.stops[0]!.slot, undefined);
});

test("nearbyPlacesWithMeta returns degraded: true when Overpass fails, and plan gets limited-data tip", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url.includes("interpreter") || url.includes("overpass")) {
      throw new Error("Overpass timeout");
    }
    return Response.json({ elements: [] });
  });
  t.mock.method(console, "warn", () => {});
  t.mock.method(console, "error", () => {});

  // 99.9 lat is unused so no cache collision
  const res = await nearbyPlacesWithMeta({ lat: 15.6059, lng: 73.7388 }, 4.7);
  assert.equal(
    res.degraded,
    true,
    "nearbyPlacesWithMeta should report degraded: true on Overpass failure",
  );
  assert.ok(res.places.length > 0, "Curated fallback landmarks should still be returned");
});

test("buildItinerary sets slot on all stops, confines food to meal windows, and clusters main stops within 2.5 km", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const urlStr = String(url);
    if (urlStr.includes("photon.komoot.io")) {
      return Response.json({
        features: [
          {
            properties: {
              osm_id: 1,
              osm_type: "node",
              name: "Panaji",
              state: "Goa",
              countrycode: "in",
            },
            geometry: { coordinates: [73.8278, 15.4989] },
          },
        ],
      });
    }
    if (urlStr.includes("overpass") || urlStr.includes("interpreter")) {
      return Response.json({
        elements: [
          {
            type: "node",
            id: 301,
            lat: 15.499,
            lon: 73.828,
            tags: {
              name: "Panaji Fish Thali",
              amenity: "restaurant",
              cuisine: "goan",
              opening_hours: "11:30-15:30,19:00-23:00",
            },
          },
          {
            type: "node",
            id: 302,
            lat: 15.498,
            lon: 73.827,
            tags: { name: "State Museum", tourism: "museum", opening_hours: "10:00-17:00" },
          },
          {
            type: "node",
            id: 303,
            lat: 15.5,
            lon: 73.829,
            tags: { name: "Art Walk", tourism: "attraction" },
          },
          {
            type: "node",
            id: 304,
            lat: 15.497,
            lon: 73.826,
            tags: { name: "Boutique Cafe", amenity: "cafe", opening_hours: "12:00-20:00" },
          },
        ],
      });
    }
    if (urlStr.includes("/table/")) {
      const match = urlStr.match(/driving\/([^?]+)/);
      const count = match ? match[1].split(";").length : 5;
      const durations = Array.from({ length: count }, (_, i) =>
        Array.from({ length: count }, (_, j) => (i === j ? 0 : 300 + Math.abs(i - j) * 120)),
      );
      const distances = Array.from({ length: count }, (_, i) =>
        Array.from({ length: count }, (_, j) => (i === j ? 0 : 800 + Math.abs(i - j) * 300)),
      );
      return Response.json({
        code: "Ok",
        durations,
        distances,
        sources: Array.from({ length: count }, () => ({ distance: 10 })),
      });
    }
    return Response.json({});
  });

  const plan = await buildItinerary({
    place: "Panaji",
    state: "Goa",
    hours: 6,
    startTime: "09:00",
    pace: "balanced",
    interests: ["Culture & history", "Local food"],
    returnToStart: false,
  });

  assert.ok(plan.stops.length >= 2, "Expected at least 2 stops");

  // 1. All result stops have slot set
  for (const stop of plan.stops) {
    assert.ok(
      stop.slot === "main" ||
        stop.slot === "meal" ||
        stop.slot === "sunset" ||
        stop.slot === "en-route",
      `Stop "${stop.title}" must have slot set, got ${stop.slot}`,
    );
  }

  // 2. No food stop lies outside a meal window (breakfast: 450-600, lunch: 720-870, dinner: 1140-1290)
  for (const stop of plan.stops) {
    if (stop.type === "food" || stop.slot === "meal") {
      const isBreakfast = stop.arrivalMinute! >= 450 && stop.arrivalMinute! <= 600;
      const isLunch = stop.arrivalMinute! >= 720 && stop.arrivalMinute! <= 870;
      const isDinner = stop.arrivalMinute! >= 1140 && stop.arrivalMinute! <= 1290;
      assert.ok(
        isBreakfast || isLunch || isDinner,
        `Food stop "${stop.title}" at minute ${stop.arrivalMinute} (${stop.time}) lies outside any meal window!`,
      );
    }
  }

  // 3. Stops within the main slot are within 2.5 km of each other
  const mainStops = plan.stops.filter((s) => s.slot === "main" && s.lat != null && s.lng != null);
  if (mainStops.length >= 2) {
    for (let i = 0; i < mainStops.length; i++) {
      for (let j = i + 1; j < mainStops.length; j++) {
        const d = distanceKm(
          { lat: mainStops[i]!.lat!, lng: mainStops[i]!.lng! },
          { lat: mainStops[j]!.lat!, lng: mainStops[j]!.lng! },
        );
        assert.ok(
          d <= 2.5,
          `Main stops "${mainStops[i]!.title}" and "${mainStops[j]!.title}" distance ${d.toFixed(2)} km exceeds 2.5 km cluster radius`,
        );
      }
    }
  }
});

test("humanizeKind, humanizeCuisine, and cleanWhy convert raw OSM tags to human wording", () => {
  // humanizeKind
  assert.equal(humanizeKind({ name: "Shri Mahamaya Temple", kind: "place_of_worship" }), "Temple");
  assert.equal(humanizeKind({ name: "Se Cathedral", kind: "place_of_worship" }), "Church");
  assert.equal(humanizeKind({ name: "Jama Masjid", kind: "place_of_worship" }), "Mosque");
  assert.equal(humanizeKind({ name: "Chapora Fort", kind: "fort" }), "Fort");
  assert.equal(humanizeKind({ name: "Burger Express", kind: "fast_food" }), "Quick bites");

  // humanizeCuisine
  assert.equal(humanizeCuisine("goan;seafood;curry"), "Goan seafood");
  assert.equal(humanizeCuisine("north_indian;chinese"), "North Indian & Chinese");
  assert.equal(humanizeCuisine(undefined), "Local dining");

  // cleanWhy
  assert.equal(
    cleanWhy("place_of_worship · in the main sightseeing cluster"),
    "Temple · in the main sightseeing cluster",
  );
  assert.equal(cleanWhy("goan;seafood;curry · lunchtime stop"), "Goan seafood · lunchtime stop");
  assert.equal(
    cleanWhy("Temple · destination cluster highlight"),
    "Temple · in the main sightseeing cluster",
  );
});
