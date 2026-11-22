import test from "node:test";
import assert from "node:assert/strict";
import {
  makeInviteToken,
  hashInviteToken,
} from "../../frontend/src/lib/location-sharing-tokens.server.ts";
import {
  isInviteValid,
  shouldPersistLocation,
  isFreshSample,
} from "../../frontend/src/lib/companion-tracking.ts";
import {
  generateCompanionInvite,
  verifyCompanionToken,
  runCompanionAction,
} from "../../frontend/src/lib/location-sharing.server.ts";
import { trackingFixture, owner, trip, person, token } from "./helpers/tracking-fixture.ts";
test("invite tokens have 256 bits of randomness and only hashes are stored", () => {
  const a = makeInviteToken(),
    b = makeInviteToken();
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, b);
  assert.notEqual(a, hashInviteToken(a));
  assert.equal(hashInviteToken(a), hashInviteToken(a));
  assert.throws(() => hashInviteToken("short"));
});
test("expired, revoked, invalid dates and exact-expiry invites fail closed", () => {
  const now = Date.parse("2026-10-18T12:00:00Z"),
    future = "2026-10-19T12:00:00Z";
  const valid = { status: "accepted", invite_expires_at: future, share_expires_at: future };
  assert.equal(isInviteValid(valid, now), true);
  for (const status of ["revoked", "blocked", "declined", "expired"])
    assert.equal(isInviteValid({ ...valid, status }, now), false);
  assert.equal(
    isInviteValid({ ...valid, invite_expires_at: new Date(now).toISOString() }, now),
    false,
  );
  assert.equal(isInviteValid({ ...valid, share_expires_at: null }, now), false);
});
test("rotating an invite invalidates the old token and allows companions without phones", async (t) => {
  const fixture = trackingFixture(t);
  const invite = await generateCompanionInvite(owner, trip, person);
  const newToken = invite.path.split("/").at(-1)!;
  assert.notEqual(newToken, token);
  assert.equal(fixture.tables.location_links![0]!.invite_token_hash, hashInviteToken(newToken));
  assert.ok(!JSON.stringify(fixture.tables).includes(newToken));
  await assert.rejects(verifyCompanionToken(token), /expired or was revoked/);
  const result = await verifyCompanionToken(newToken);
  assert.equal(result.companionName, "Companion");
  assert.ok(!JSON.stringify(result).includes("9876543210"));
});
test("invites reject a different guardian before any writes", async (t) => {
  const fixture = trackingFixture(t);
  await assert.rejects(
    generateCompanionInvite("66666666-6666-4666-8666-666666666666", trip, person),
  );
  assert.equal(fixture.calls.filter((call) => call.method !== "GET").length, 0);
});
test("location broadcasts are frequent but database snapshots are throttled and pause clears location", async (t) => {
  const fixture = trackingFixture(t);
  const sample = {
    lat: 15.5,
    lng: 73.8,
    accuracy: 7,
    battery: null,
    capturedAt: new Date().toISOString(),
  };
  await runCompanionAction({ action: "location", token, sample });
  await runCompanionAction({ action: "location", token, sample });
  assert.equal(
    fixture.calls.filter((call) => call.table === "location_links" && call.method === "PATCH")
      .length,
    1,
  );
  assert.equal(fixture.broadcasts.length, 2);
  await runCompanionAction({ action: "pause", token });
  assert.equal(fixture.tables.location_links![0]!.last_lat, null);
  assert.equal(fixture.tables.location_links![0]!.sharing_paused, true);
});
test("snapshot boundary and stale GPS are explicit", () => {
  assert.equal(shouldPersistLocation(new Date(1000).toISOString(), 30999), false);
  assert.equal(shouldPersistLocation(new Date(1000).toISOString(), 31000), true);
  assert.equal(
    isFreshSample(
      { lat: 0, lng: 0, accuracy: 0, battery: 0, capturedAt: new Date(0).toISOString() },
      60001,
    ),
    false,
  );
});

test("a companion can permanently deactivate the invite and erase its last coordinates", async (t) => {
  const fixture = trackingFixture(t);
  await runCompanionAction({ action: "stop", token });
  assert.equal(fixture.tables.location_links![0]!.status, "revoked");
  assert.equal(fixture.tables.location_links![0]!.last_lat, null);
  await assert.rejects(verifyCompanionToken(token), /revoked/);
});

test("concurrent location updates use one database snapshot", async (t) => {
  const fixture = trackingFixture(t);
  const sample = {
    lat: 15.5,
    lng: 73.8,
    accuracy: 4,
    battery: 60,
    capturedAt: new Date().toISOString(),
  };
  const results = await Promise.all([
    runCompanionAction({ action: "location", token, sample }),
    runCompanionAction({ action: "location", token, sample }),
  ]);
  assert.equal(fixture.broadcasts.length, 2);
  assert.equal(results.filter((result) => "persisted" in result && result.persisted).length, 1);
  assert.ok(fixture.tables.location_links![0]!.last_synced_at);
});
