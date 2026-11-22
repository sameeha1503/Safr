import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maskPhone,
  normalizeE164,
  formatAlertMessage,
  sendSafeTagAlert,
} from "../../frontend/src/lib/notifications.server.ts";
import { checkRateLimit, sanitizeText, sanitizeCoordinates } from "../../frontend/src/lib/rate-limit.server.ts";

test("phone normalization to E.164 (+91)", () => {
  assert.equal(normalizeE164("9921827979"), "+919921827979");
  assert.equal(normalizeE164("919921827979"), "+919921827979");
  assert.equal(normalizeE164("+91 (992) 182-7979"), "+919921827979");
  assert.equal(normalizeE164("09921827979"), "+919921827979");
  assert.equal(normalizeE164("+14155238886"), "+14155238886");
  assert.equal(normalizeE164("9123456789"), "+919123456789");
  assert.equal(normalizeE164("14155238886"), "+14155238886");
  assert.equal(normalizeE164("00441632960961"), "+441632960961");
  // Invalid Indian mobile patterns and garbage return null
  assert.equal(normalizeE164("1234567890"), null);
  assert.equal(normalizeE164("5551234567"), null);
  assert.equal(normalizeE164("+911234567890"), null);
  assert.equal(normalizeE164("12345"), null);
  assert.equal(normalizeE164(""), null);
});

test("phone masking for secure logging", () => {
  assert.equal(maskPhone("+919876543210"), "+9******10");
  assert.equal(maskPhone("9876543210"), "98******10");
  assert.equal(maskPhone("123"), "****");
});

test("alert message formatting includes child name, code, location, and map link", () => {
  const msgWithMap = formatAlertMessage({
    childName: "Aarav",
    code: "WAZFYJ",
    locationText: "Baga Beach Lifeguard Tower 2",
    finderContact: "+91 98765 00000",
    lat: 15.5523,
    lng: 73.7517,
    guardianPhone: "+919876543210",
    timeIst: "30 Sep 2026, 09:30 PM IST",
  });

  assert.ok(msgWithMap.includes("Aarav (tag WAZFYJ) has been found."));
  assert.ok(msgWithMap.includes("Location: Baga Beach Lifeguard Tower 2."));
  assert.ok(msgWithMap.includes("Map: https://www.google.com/maps?q=15.5523,73.7517"));
  assert.ok(msgWithMap.includes("Finder contact: +91 98765 00000."));
  assert.ok(msgWithMap.includes("Time: 30 Sep 2026, 09:30 PM IST."));

  const msgWithoutMap = formatAlertMessage({
    childName: "Rohan",
    code: "WAZFYJ",
    locationText: null,
    finderContact: null,
    lat: null,
    lng: null,
    guardianPhone: "+919876543210",
    timeIst: "30 Sep 2026, 09:30 PM IST",
  });

  assert.ok(msgWithoutMap.includes("Location: not provided."));
  assert.ok(!msgWithoutMap.includes("Map:"));
  assert.ok(msgWithoutMap.includes("Finder contact: not provided."));
});

test("alert message formatting strips http/https/www links and collapses whitespace", () => {
  const msgWithLinks = formatAlertMessage({
    childName: "Aarav",
    code: "WAZFYJ",
    locationText: "Near  https://example.com/map   Tito's Lane",
    finderContact: "+91 98765 00000   www.spam.link  (Shop)",
    lat: 15.5523,
    lng: 73.7517,
    guardianPhone: "+919876543210",
    timeIst: "30 Sep 2026, 09:30 PM IST",
  });

  assert.ok(msgWithLinks.includes("Location: Near [link removed] Tito's Lane."));
  assert.ok(msgWithLinks.includes("Finder contact: +91 98765 00000 [link removed] (Shop)."));
  assert.ok(!msgWithLinks.includes("https://example.com/map"));
  assert.ok(!msgWithLinks.includes("www.spam.link"));
});

test("input sanitization strips HTML tags and caps length", () => {
  assert.equal(
    sanitizeText("<script>alert('hack')</script>Near Tito's", 50),
    "alert('hack')Near Tito's",
  );
  assert.equal(sanitizeText("   Hello world   ", 5), "Hello");
  assert.equal(sanitizeText(null, 100), null);
  assert.equal(sanitizeCoordinates("15.5523"), 15.5523);
  assert.equal(sanitizeCoordinates("abc"), null);
  assert.equal(sanitizeCoordinates("15.55junk"), null);
  assert.equal(sanitizeCoordinates(""), null);
  assert.equal(sanitizeCoordinates(true), null);
  assert.equal(sanitizeText({ location: "unexpected object" }, 50), null);
});

test("rate limiting enforces 5 requests per 10 minutes per IP/code", () => {
  const testIp = "192.168.1.100";
  const testCode = "TESTTAG";

  for (let i = 0; i < 5; i++) {
    const res = checkRateLimit(testIp, testCode);
    assert.equal(res.allowed, true);
  }

  const blockedRes = checkRateLimit(testIp, testCode);
  assert.equal(blockedRes.allowed, false);
  assert.ok((blockedRes.retryAfterSec || 0) > 0);
});

test("notification service dispatches mock mode alerts cleanly", async () => {
  const res = await sendSafeTagAlert({
    childName: "Aarav",
    code: "WAZFYJ",
    locationText: "Near Baga Lifeguard 1",
    finderContact: "+91 99999 88888",
    guardianPhone: "+919876543210",
    timeIst: "30 Sep 2026, 09:30 PM IST",
  });

  assert.equal(res.whatsapp.status, "mocked");
  assert.equal(res.sms.status, "mocked");
});
