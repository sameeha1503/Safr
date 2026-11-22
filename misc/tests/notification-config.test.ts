import test from "node:test";
import assert from "node:assert/strict";
import { notificationReadiness } from "../../frontend/src/lib/notification-config.ts";
import { sendEmergencyMessage } from "../../frontend/src/lib/notifications.server.ts";

test("mock and missing settings never pass the real notification readiness gate", () => {
  const result = notificationReadiness({});
  assert.equal(result.ready, false);
  assert.match(result.issues.join(" "), /Mock mode/);
  assert.match(result.issues.join(" "), /TWILIO_AUTH_TOKEN/);
});

test("readiness requires senders only for selected channels and never prints secrets", () => {
  const env = {
    NOTIFY_MODE: "live",
    NOTIFY_CHANNELS: "sms",
    TWILIO_ACCOUNT_SID: "fixture-account",
    TWILIO_AUTH_TOKEN: "fixture-secret",
    TWILIO_SMS_FROM: "+15555550100",
  };
  assert.equal(notificationReadiness(env).ready, true);
  const result = notificationReadiness({ ...env, NOTIFY_CHANNELS: "sms,whatsapp" });
  assert.equal(result.ready, false);
  assert.match(result.issues.join(" "), /WhatsApp sender/);
  assert.doesNotMatch(JSON.stringify(result), /fixture-secret|fixture-account/);
});

test("invalid mode or channel cannot accidentally dispatch real alerts", async (t) => {
  const before = { mode: process.env.NOTIFY_MODE, channels: process.env.NOTIFY_CHANNELS };
  t.after(() => {
    if (before.mode === undefined) delete process.env.NOTIFY_MODE;
    else process.env.NOTIFY_MODE = before.mode;
    if (before.channels === undefined) delete process.env.NOTIFY_CHANNELS;
    else process.env.NOTIFY_CHANNELS = before.channels;
  });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new Error("No network permitted");
  });
  for (const [mode, channels] of [
    ["liv", "sms"],
    ["live", "email"],
  ]) {
    process.env.NOTIFY_MODE = mode;
    process.env.NOTIFY_CHANNELS = channels;
    const result = await sendEmergencyMessage("+15555550100", "Fixture alert");
    assert.equal(result.sms.status, "failed");
    assert.equal(result.whatsapp.status, "failed");
  }
  assert.equal(calls, 0);
});
