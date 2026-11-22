import test from "node:test";
import assert from "node:assert/strict";
import { handleTagAlertRequest } from "../../frontend/src/lib/safetag.server.ts";
import { sendSafeTagAlert } from "../../frontend/src/lib/notifications.server.ts";

test("malformed JSON values return a client error before querying the database", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected network call");
  });
  for (const value of [null, [], "text", 42]) {
    const response = await handleTagAlertRequest(
      new Request("https://safr.test/alert", { method: "POST", body: JSON.stringify(value) }),
      `BAD-${String(value)}`,
    );
    assert.equal(response.status, 400);
  }
});

test("mock delivery is never reported as a real guardian notification and invalid coordinates are discarded", async (t) => {
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NOTIFY_MODE"];
  const previous = keys.map((key) => process.env[key]);
  t.after(() =>
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    }),
  );
  process.env.SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
  process.env.NOTIFY_MODE = "mock";
  let scan: Record<string, unknown> | undefined;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    assert.ok(init?.signal);
    if (String(input).includes("/safety_tags?"))
      return Response.json([
        { id: "tag-id", token: "MOCK", person_name: "Test", guardian_phone: "9876543210" },
      ]);
    assert.ok(String(input).includes("/safety_tag_scans"));
    scan = JSON.parse(String(init?.body));
    return Response.json(null, { status: 201 });
  });
  const response = await handleTagAlertRequest(
    new Request("https://safr.test/alert", {
      method: "POST",
      body: JSON.stringify({ lat: 95, lng: 73, location: 123 }),
    }),
    "MOCK",
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).notified, false);
  assert.equal(scan?.lat, null);
  assert.equal(scan?.lng, null);
  assert.equal(scan?.finder_note, null);
});

test("live notification configuration failures are failures rather than simulated successes", async (t) => {
  const keys = ["NOTIFY_MODE", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "NOTIFY_CHANNELS"];
  const previous = keys.map((key) => process.env[key]);
  t.after(() =>
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    }),
  );
  process.env.NOTIFY_MODE = "live";
  process.env.NOTIFY_CHANNELS = "whatsapp";
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  const result = await sendSafeTagAlert({
    childName: "Test",
    code: "MOCK",
    guardianPhone: "9876543210",
    timeIst: "fixture time",
  });
  assert.equal(result.whatsapp.status, "failed");
  assert.equal(result.sms.status, "skipped");
});
