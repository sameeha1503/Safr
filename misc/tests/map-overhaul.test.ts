import test from "node:test";
import assert from "node:assert/strict";
import { createOfflineTrip } from "../../frontend/src/features/map/lib/offline-trip.ts";
import {
  roadReportInput,
  isVisibleRoadReport,
  type RoadReport,
} from "../../frontend/src/lib/road-reports.ts";
import { matchesEssential } from "../../frontend/src/features/map/lib/goa-catalogue.ts";
import type { ScoredRoute } from "../../frontend/src/lib/maps.server.ts";

test("offline document escapes untrusted route text and needs no network", () => {
  const route = {
    summary: "<script>alert(1)</script>",
    label: "Test",
    mode: "walking",
    distanceKm: 2,
    durationMin: 20,
    steps: [{ instruction: "<img src=x onerror=alert(1)>", distanceMeters: 20 }],
  } as ScoredRoute;
  const html = createOfflineTrip(route, "2026-10-25");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes("tel:112"));
});

test("reports require bounded Goa coordinates and useful text", () => {
  assert.equal(
    roadReportInput.safeParse({
      lat: 15.5,
      lng: 73.8,
      kind: "flooding",
      detail: "Road covered with water",
    }).success,
    true,
  );
  for (const invalid of [{ lat: 0 }, { lng: 180 }, { kind: "fake" }, { detail: "" }]) {
    assert.equal(
      roadReportInput.safeParse({
        lat: 15.5,
        lng: 73.8,
        kind: "flooding",
        detail: "Road covered with water",
        ...invalid,
      }).success,
      false,
    );
  }
});

test("pending reports are private and expiry wins over approval", () => {
  const report: RoadReport = {
    id: "1",
    user_id: "owner",
    status: "pending",
    lat: 15.5,
    lng: 73.8,
    kind: "closure",
    detail: "Road barricaded",
    created_at: "2026-10-25T00:00:00Z",
    expires_at: "2026-10-25T06:00:00Z",
  };
  const now = Date.parse("2026-10-25T01:00:00Z");
  assert.equal(isVisibleRoadReport(report, "other", now), false);
  assert.equal(isVisibleRoadReport(report, "owner", now), true);
  assert.equal(isVisibleRoadReport({ ...report, status: "approved" }, "other", now), true);
  assert.equal(
    isVisibleRoadReport({ ...report, status: "approved" }, "owner", Date.parse(report.expires_at)),
    false,
  );
});

test("essentials filters rely on source tags instead of names", () => {
  assert.equal(
    matchesEssential(
      { id: "1", lat: 15.5, lng: 73.8, tags: { name: "Hospital Cafe", amenity: "cafe" } },
      "Hospitals",
    ),
    false,
  );
  assert.equal(
    matchesEssential(
      { id: "2", lat: 15.5, lng: 73.8, tags: { amenity: "ferry_terminal" } },
      "Ferries",
    ),
    true,
  );
});
