import crypto from "node:crypto";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export function requestId(value) {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value)
    ? value
    : crypto.randomUUID();
}

export function healthPayload(
  now = new Date(),
  uptimeSeconds = process.uptime(),
) {
  return {
    status: "ok",
    timestamp: now.toISOString(),
    uptimeSeconds: Math.max(0, Math.floor(uptimeSeconds)),
  };
}

export function safePathname(pathname) {
  return pathname.replace(/^\/(share|t)\/[^/]+/, "/$1/[redacted]");
}

export function requestLog({ id, method, pathname, status, durationMs }) {
  return JSON.stringify({
    level: status >= 500 ? "error" : "info",
    event: "http_request",
    requestId: id,
    method,
    pathname: safePathname(pathname),
    status,
    durationMs: Math.max(0, Math.round(durationMs)),
  });
}
