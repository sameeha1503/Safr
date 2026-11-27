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

test("mock delivery counts as notified and invalid coordinates are ignored", async (t) => {
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
  assert.equal((await response.json()).notified, true);
  assert.equal(scan?.lat, null);
  assert.equal(scan?.lng, null);
  assert.equal(scan?.finder_note, null);
});

test("disabled or inactive tag returns 403 and records no scan or notification", async (t) => {
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

  let scanInserted = false;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).includes("/safety_tags?")) {
      return Response.json([
        {
          id: "tag-disabled-id",
          token: "DISABLED-TAG",
          person_name: "Secret Name",
          guardian_phone: "9876543210",
          is_active: false,
        },
      ]);
    }
    if (String(input).includes("/safety_tag_scans")) {
      scanInserted = true;
      return Response.json(null, { status: 201 });
    }
    return Response.json(null);
  });

  const response = await handleTagAlertRequest(
    new Request("https://safr.test/alert", {
      method: "POST",
      headers: { "x-forwarded-for": "10.10.1.1" },
      body: JSON.stringify({ location: "At the beach" }),
    }),
    "DISABLED-TAG",
  );

  assert.equal(response.status, 403);
  const data = await response.json();
  assert.equal(data.error, "This SafeTag has been disabled by its owner.");
  assert.equal(data.person_name, undefined);
  assert.equal(data.guardian_phone, undefined);
  assert.equal(scanInserted, false);
});

test("active tag returns 200 and records scan", async (t) => {
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

  let scanInserted = false;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).includes("/safety_tags?")) {
      return Response.json([
        {
          id: "tag-active-id",
          token: "ACTIVE-TAG",
          person_name: "Active Person",
          guardian_phone: "9876543210",
          is_active: true,
        },
      ]);
    }
    if (String(input).includes("/safety_tag_scans")) {
      scanInserted = true;
      return Response.json(null, { status: 201 });
    }
    return Response.json(null);
  });

  const response = await handleTagAlertRequest(
    new Request("https://safr.test/alert", {
      method: "POST",
      headers: { "x-forwarded-for": "10.10.1.2" },
      body: JSON.stringify({ location: "Near the shack" }),
    }),
    "ACTIVE-TAG",
  );

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.success, true);
  assert.equal(scanInserted, true);
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
