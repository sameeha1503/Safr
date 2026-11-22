import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getNotifyChannels,
  maskPhoneNumber,
} from "../../frontend/src/lib/notifications.server.ts";

test("notifications.server getNotifyChannels defaults to whatsapp when unset", () => {
  const original = process.env["NOTIFY_CHANNELS"];
  delete process.env["NOTIFY_CHANNELS"];

  const channels = getNotifyChannels();
  assert.deepEqual(channels, ["whatsapp"]);

  if (original !== undefined) {
    process.env["NOTIFY_CHANNELS"] = original;
  }
});

test("notifications.server getNotifyChannels parses comma-separated channels", () => {
  const original = process.env["NOTIFY_CHANNELS"];
  process.env["NOTIFY_CHANNELS"] = "sms, whatsapp";

  const channels = getNotifyChannels();
  assert.deepEqual(channels, ["sms", "whatsapp"]);

  if (original !== undefined) {
    process.env["NOTIFY_CHANNELS"] = original;
  } else {
    delete process.env["NOTIFY_CHANNELS"];
  }
});

test("notifications.server maskPhoneNumber protects user and finder privacy", () => {
  assert.equal(maskPhoneNumber("+919876543210"), "+9******10");
  assert.equal(maskPhoneNumber("9876543210"), "98******10");
  assert.equal(maskPhoneNumber("123"), "****");
});

test("multi-stop distance and duration aggregation logic", () => {
  const mockLegs = [
    { distance: 15400, duration: 1800, legIndex: 0 },
    { distance: 8200, duration: 900, legIndex: 1 },
    { distance: 4100, duration: 600, legIndex: 2 },
  ];

  const totalMeters = mockLegs.reduce((acc, leg) => acc + leg.distance, 0);
  const totalSeconds = mockLegs.reduce((acc, leg) => acc + leg.duration, 0);

  assert.equal(totalMeters, 27700);
  assert.equal(totalSeconds, 3300);

  // Formatted representations
  const distanceKm = (totalMeters / 1000).toFixed(1);
  const durationMin = Math.round(totalSeconds / 60);

  assert.equal(distanceKm, "27.7");
  assert.equal(durationMin, 55);
});
