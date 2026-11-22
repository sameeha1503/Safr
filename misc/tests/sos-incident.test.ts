import test from "node:test";
import assert from "node:assert/strict";
import {
  runCompanionAction,
  runGuardianAction,
  broadcastTracking,
} from "../../frontend/src/lib/location-sharing.server.ts";
import { companionActionSchema } from "../../frontend/src/lib/tracking-actions.ts";
import { trackingFixture, owner, trip, token, link } from "./helpers/tracking-fixture.ts";
test("SOS accepts unavailable GPS but derives sender and trip from the invite", async (t) => {
  const fixture = trackingFixture(t);
  const request = companionActionSchema.parse({
    action: "sos",
    token,
    point: null,
    name: "Forged",
    tripId: "attacker",
    role: "guardian",
  });
  const result = await runCompanionAction(request);
  assert.ok("incident" in result);
  if (!("incident" in result)) return;
  assert.equal(result.incident.sender_name, "Companion");
  assert.equal(result.incident.triggered_by_id, link);
  assert.equal(result.incident.trip_id, trip);
  assert.equal(result.incident.lat, null);
  assert.match(result.notification, /not sent/);
  await runCompanionAction(request);
  assert.equal(fixture.tables.sos_incidents!.length, 1);
  const message = JSON.stringify(fixture.broadcasts[0]);
  assert.ok(message.includes('"private":true'));
  const hints = (
    fixture.broadcasts[0]!.messages as { private: boolean; payload: unknown }[]
  ).filter((item) => !item.private);
  assert.deepEqual(
    hints.map((item) => item.payload),
    [{ refresh: true }],
  );
  await runGuardianAction(owner, {
    action: "resolve",
    tripId: trip,
    incidentId: result.incident.id,
    status: "false_alarm",
  });
  assert.equal(fixture.tables.sos_incidents![0]!.status, "false_alarm");
});
test("revoked tokens cannot create SOS or read private trip information", async (t) => {
  const fixture = trackingFixture(t);
  fixture.tables.location_links![0]!.status = "revoked";
  await assert.rejects(runCompanionAction({ action: "sos", token, point: null }), /revoked/);
  assert.equal(fixture.tables.sos_incidents!.length, 0);
});
test("broadcast errors fail soft rather than claiming dispatch", async (t) => {
  trackingFixture(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 503 }));
  assert.equal(await broadcastTracking(trip, { kind: "sos" }), false);
});

test("guardian SOS queues both configured channels only for accepted companion contacts", async (t) => {
  const fixture = trackingFixture(t),
    dbFetch = globalThis.fetch;
  fixture.tables.location_links![0]!.status = "accepted";
  fixture.tables.location_links![0]!.phone_number = "9876543210";
  fixture.tables.travellers![0]!.phone_number = "9876543210";
  const keys = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "TWILIO_SMS_FROM",
    "NOTIFY_CHANNELS",
  ];
  const previous = keys.map((key) => process.env[key]);
  t.after(() =>
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    }),
  );
  process.env.NOTIFY_MODE = "live";
  process.env.NOTIFY_CHANNELS = "whatsapp,sms";
  process.env.TWILIO_ACCOUNT_SID = "ACfixture";
  process.env.TWILIO_AUTH_TOKEN = "fixture";
  process.env.TWILIO_WHATSAPP_FROM = "+15005550006";
  process.env.TWILIO_SMS_FROM = "+15005550006";
  const recipients: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).startsWith("https://api.twilio.com/")) {
      assert.ok(init?.signal);
      const form = new URLSearchParams(String(init?.body));
      recipients.push(form.get("To")!);
      assert.ok(!form.get("Body")!.includes(token));
      return Response.json({ status: "queued" }, { status: 201 });
    }
    return dbFetch(input, init);
  });
  const result = await runGuardianAction(owner, { action: "sos", tripId: trip, point: null });
  assert.ok("incident" in result);
  if (!("incident" in result)) return;
  assert.deepEqual(recipients, ["whatsapp:+919876543210", "+919876543210"]);
  assert.match(result.notification, /delivery is not confirmed/);
  assert.match(String(fixture.tables.sos_incidents![0]!.delivery_summary), /1 of 1/);
});
