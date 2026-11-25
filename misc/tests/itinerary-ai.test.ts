import test from "node:test";
import assert from "node:assert/strict";
import { buildItinerary } from "../../frontend/src/lib/travel.server.ts";
import { distanceKm } from "../../frontend/src/lib/geo.ts";

const CHAPORA_COORD = { lat: 15.6059, lng: 73.7388 };

test("Gemini selection: valid slot choice picks alternative candidate and sets aiStatus 'used'", async (t) => {
  const origKey = process.env["GEMINI_API_KEY"];
  process.env["GEMINI_API_KEY"] = "mock-gemini-key";
  t.after(() => {
    if (origKey !== undefined) {
      process.env["GEMINI_API_KEY"] = origKey;
    } else {
      delete process.env["GEMINI_API_KEY"];
    }
  });

  let chosenAlternativeId = "";
  let targetSlotId = "";

  t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);

      if (urlStr.includes("overpass") || urlStr.includes("interpreter")) {
        throw new Error("Overpass down");
      }

      if (urlStr.includes("photon.komoot.io")) {
        return Response.json({
          features: [
            {
              properties: {
                osm_id: 1,
                osm_type: "node",
                name: "Chapora Fort",
                state: "Goa",
                countrycode: "in",
              },
              geometry: {
                coordinates: [CHAPORA_COORD.lng, CHAPORA_COORD.lat],
              },
            },
          ],
        });
      }

      if (urlStr.includes("/table/")) {
        const match = urlStr.match(/driving\/([^?]+)/);
        const count = match ? match[1].split(";").length : 10;
        const durations = Array.from({ length: count }, (_, i) =>
          Array.from({ length: count }, (_, j) =>
            i === j ? 0 : 300 + Math.abs(i - j) * 60,
          ),
        );
        const distances = Array.from({ length: count }, (_, i) =>
          Array.from({ length: count }, (_, j) =>
            i === j ? 0 : 800 + Math.abs(i - j) * 200,
          ),
        );
        return Response.json({
          code: "Ok",
          durations,
          distances,
          sources: Array.from({ length: count }, () => ({ distance: 20 })),
        });
      }

      if (urlStr.includes("generativelanguage.googleapis.com")) {
        const bodyObj = JSON.parse(String(init?.body || "{}"));
        const promptJson = JSON.parse(
          bodyObj?.contents?.[0]?.parts?.[0]?.text || "{}",
        );
        const slots = promptJson?.slots || [];

        // Pick a slot that has >= 2 candidates
        const multiCandSlot = slots.find(
          (s: { candidates?: unknown[] }) =>
            Array.isArray(s.candidates) && s.candidates.length >= 2,
        );
        assert.ok(multiCandSlot, "Expected a slot with at least 2 candidates");

        targetSlotId = multiCandSlot.slotId;
        // Candidate 0 is the deterministic top choice; candidate 1 is the alternative
        chosenAlternativeId = multiCandSlot.candidates[1].id;

        const aiResponseText = JSON.stringify({
          slots: [
            {
              slotId: targetSlotId,
              placeId: chosenAlternativeId,
              why: "Handpicked by AI for its exceptional sunset views",
            },
          ],
        });

        return Response.json({
          candidates: [
            {
              content: {
                parts: [{ text: aiResponseText }],
              },
            },
          ],
        });
      }

      return Response.json({});
    },
  );

  const plan = await buildItinerary({
    place: "Chapora Fort",
    state: "Goa",
    hours: 8,
    startTime: "09:00",
    date: "2026-11-25",
    pace: "balanced",
    interests: ["History & heritage", "Beaches & sunsets", "Local food"],
    returnToStart: false,
  });

  assert.equal(plan.aiStatus, "used", "Expected aiStatus to be 'used'");
  assert.ok(chosenAlternativeId, "Expected alternative ID to be captured");

  const matchingStop = plan.stops.find((s) => s.id === chosenAlternativeId);
  assert.ok(
    matchingStop,
    `Expected plan to include AI-chosen alternative stop ${chosenAlternativeId}`,
  );
  assert.ok(
    matchingStop.why?.includes(
      "Handpicked by AI for its exceptional sunset views",
    ),
    `Expected why to contain AI reason, got: ${matchingStop.why}`,
  );
});

test("Gemini selection fallback: ungrounded ID not in shortlist falls back to deterministic choice", async (t) => {
  const origKey = process.env["GEMINI_API_KEY"];
  process.env["GEMINI_API_KEY"] = "mock-gemini-key";
  t.after(() => {
    if (origKey !== undefined) {
      process.env["GEMINI_API_KEY"] = origKey;
    } else {
      delete process.env["GEMINI_API_KEY"];
    }
  });

  let deterministicTopChoiceId = "";
  let targetSlotId = "";

  t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);

      if (urlStr.includes("overpass") || urlStr.includes("interpreter")) {
        throw new Error("Overpass down");
      }

      if (urlStr.includes("photon.komoot.io")) {
        return Response.json({
          features: [
            {
              properties: {
                osm_id: 1,
                osm_type: "node",
                name: "Chapora Fort",
                state: "Goa",
                countrycode: "in",
              },
              geometry: {
                coordinates: [CHAPORA_COORD.lng, CHAPORA_COORD.lat],
              },
            },
          ],
        });
      }

      if (urlStr.includes("/table/")) {
        const match = urlStr.match(/driving\/([^?]+)/);
        const count = match ? match[1].split(";").length : 10;
        const durations = Array.from({ length: count }, (_, i) =>
          Array.from({ length: count }, (_, j) =>
            i === j ? 0 : 300 + Math.abs(i - j) * 60,
          ),
        );
        const distances = Array.from({ length: count }, (_, i) =>
          Array.from({ length: count }, (_, j) =>
            i === j ? 0 : 800 + Math.abs(i - j) * 200,
          ),
        );
        return Response.json({
          code: "Ok",
          durations,
          distances,
          sources: Array.from({ length: count }, () => ({ distance: 20 })),
        });
      }

      if (urlStr.includes("generativelanguage.googleapis.com")) {
        const bodyObj = JSON.parse(String(init?.body || "{}"));
        const promptJson = JSON.parse(
          bodyObj?.contents?.[0]?.parts?.[0]?.text || "{}",
        );
        const slots = promptJson?.slots || [];

        const multiCandSlot = slots.find(
          (s: { candidates?: unknown[] }) =>
            Array.isArray(s.candidates) && s.candidates.length >= 2,
        );
        assert.ok(multiCandSlot, "Expected a slot with at least 2 candidates");

        targetSlotId = multiCandSlot.slotId;
        deterministicTopChoiceId = multiCandSlot.candidates[0].id;

        // Return a fabricated placeId NOT in the candidates shortlist
        const aiResponseText = JSON.stringify({
          slots: [
            {
              slotId: targetSlotId,
              placeId: "fake/fabricated-id-not-in-shortlist",
              why: "Fabricated stop",
            },
          ],
        });

        return Response.json({
          candidates: [
            {
              content: {
                parts: [{ text: aiResponseText }],
              },
            },
          ],
        });
      }

      return Response.json({});
    },
  );

  const plan = await buildItinerary({
    place: "Chapora Fort",
    state: "Goa",
    hours: 8,
    startTime: "09:00",
    date: "2026-11-25",
    pace: "balanced",
    interests: ["History & heritage", "Beaches & sunsets", "Local food"],
    returnToStart: false,
  });

  // Since Gemini's ID was not in shortlist, slotSelections was not set, falling back to deterministic choice
  assert.notEqual(
    plan.aiStatus,
    "used",
    "aiStatus must not be 'used' when no valid slot was selected",
  );
  assert.ok(
    deterministicTopChoiceId,
    "Expected deterministic top choice ID to be captured",
  );

  const deterministicStop = plan.stops.find(
    (s) => s.id === deterministicTopChoiceId,
  );
  assert.ok(
    deterministicStop,
    `Plan must fall back to the deterministic top choice ${deterministicTopChoiceId}`,
  );
  assert.ok(
    !plan.stops.some((s) => s.id === "fake/fabricated-id-not-in-shortlist"),
    "Plan must not contain fabricated place ID",
  );
});
