import test from "node:test";
import assert from "node:assert/strict";
import {
  healthPayload,
  requestId,
  requestLog,
} from "../../frontend/server-observability.mjs";

test("health payload is deterministic and rounds uptime", () => {
  assert.deepEqual(healthPayload(new Date("2026-10-25T10:00:00.000Z"), 12.9), {
    status: "ok",
    timestamp: "2026-10-25T10:00:00.000Z",
    uptimeSeconds: 12,
  });
});

test("request ID accepts safe upstream IDs and replaces unsafe values", () => {
  assert.equal(requestId("edge_abc-123"), "edge_abc-123");
  assert.match(requestId("contains spaces"), /^[0-9a-f-]{36}$/);
});

test("request logs are structured and redact query parameters", () => {
  const entry = JSON.parse(
    requestLog({
      id: "test-id",
      method: "GET",
      pathname: "/share/secret-companion-token",
      status: 503,
      durationMs: 3.6,
    }),
  );
  assert.deepEqual(entry, {
    level: "error",
    event: "http_request",
    requestId: "test-id",
    method: "GET",
    pathname: "/share/[redacted]",
    status: 503,
    durationMs: 4,
  });
});
