import test from "node:test";
import assert from "node:assert/strict";
import {
  runGuardianAction,
  verifyCompanionToken,
} from "../../frontend/src/lib/location-sharing.server.ts";
import { meetingSchema } from "../../frontend/src/lib/companion-tracking.ts";
import { trackingFixture, owner, trip, token } from "./helpers/tracking-fixture.ts";
test("meeting points are saved, replaced, cleared and returned only through a valid invite", async (t) => {
  const fixture = trackingFixture(t);
  const point = { lat: 15.5, lng: 73.8, title: "Entrance", notes: null };
  await runGuardianAction(owner, { action: "meeting", tripId: trip, point });
  assert.equal((await verifyCompanionToken(token)).meeting?.title, "Entrance");
  await runGuardianAction(owner, {
    action: "meeting",
    tripId: trip,
    point: { ...point, title: "Cafe" },
  });
  assert.equal(fixture.tables.trip_meeting_points!.length, 1);
  await runGuardianAction(owner, { action: "clear", tripId: trip });
  assert.equal((await verifyCompanionToken(token)).meeting, null);
  await assert.rejects(
    runGuardianAction("66666666-6666-4666-8666-666666666666", { action: "clear", tripId: trip }),
  );
});
test("meeting payload rejects invalid coordinates and overlong text", () => {
  assert.equal(
    meetingSchema.safeParse({ lat: 91, lng: 0, title: "Spot", notes: null }).success,
    false,
  );
  assert.equal(meetingSchema.safeParse({ lat: 0, lng: 0, title: " ", notes: null }).success, false);
  assert.equal(
    meetingSchema.safeParse({ lat: 0, lng: 0, title: "Spot", notes: "x".repeat(501) }).success,
    false,
  );
});
