import test from "node:test";
import assert from "node:assert/strict";
import {
  sampleSchema,
  mergeTrackingSnapshot,
  applyLiveMember,
  type GuardianState,
} from "../../frontend/src/lib/companion-tracking.ts";
import { createHoldTrigger } from "../../frontend/src/lib/hold-trigger.ts";
const state: GuardianState = {
  trip: { id: "trip", name: "Goa" },
  travellers: [],
  meeting: null,
  incidents: [],
  members: [
    {
      id: "companion",
      revision: "new",
      name: "Test",
      status: "accepted",
      paused: false,
      sample: { lat: 15, lng: 73, accuracy: 4, battery: 50, capturedAt: "2026-10-18T12:00:30Z" },
    },
  ],
};
test("database refresh retains newer live GPS but respects pause and invite rotation", () => {
  const old = structuredClone(state);
  old.members[0]!.sample!.capturedAt = "2026-10-18T12:00:00Z";
  assert.equal(
    mergeTrackingSnapshot(state, old).members[0]!.sample!.capturedAt,
    "2026-10-18T12:00:30Z",
  );
  old.members[0]!.paused = true;
  old.members[0]!.sample = null;
  assert.equal(mergeTrackingSnapshot(state, old).members[0]!.sample, null);
  old.members[0]!.paused = false;
  old.members[0]!.revision = "replacement";
  assert.equal(mergeTrackingSnapshot(state, old).members[0]!.sample, null);
});
test("delayed broadcast cannot resurrect revoked or replaced invites", () => {
  const member = { ...state.members[0]!, revision: "old" };
  assert.equal(applyLiveMember(state, member), state);
  const revoked = structuredClone(state);
  revoked.members[0]!.status = "revoked";
  assert.equal(applyLiveMember(revoked, state.members[0]!), revoked);
});
test("SOS hold cancels early releases and triggers once after two uninterrupted seconds", () => {
  let run: (() => void) | undefined,
    delay = 0,
    fired = 0;
  const hold = createHoldTrigger(
    () => fired++,
    (callback, ms) => {
      run = callback;
      delay = ms;
      return () => {
        run = undefined;
      };
    },
  );
  hold.start();
  assert.equal(delay, 2000);
  hold.cancel();
  assert.equal(run, undefined);
  assert.equal(fired, 0);
  hold.start();
  const scheduled = run;
  hold.start();
  assert.equal(run, scheduled);
  run?.();
  assert.equal(fired, 1);
  hold.cancel();
  assert.equal(fired, 1);
});

test("database timestamps with UTC offsets remain valid GPS snapshots", () => {
  assert.equal(
    sampleSchema.safeParse({ ...state.members[0]!.sample, capturedAt: "2026-10-18T12:00:30+00:00" })
      .success,
    true,
  );
});
