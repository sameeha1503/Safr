import test from "node:test";
import assert from "node:assert/strict";
import {
  trackingDatabaseError,
  trackingFailureKind,
  TRACKING_SETUP_MESSAGE,
} from "../../frontend/src/lib/tracking-errors.ts";

test("permanent Reunite setup and session failures are distinguished from retryable outages", () => {
  assert.equal(trackingFailureKind(new Error(TRACKING_SETUP_MESSAGE)), "setup");
  assert.equal(
    trackingFailureKind(new Error("Set up a trip first, or select a trip that belongs to you.")),
    "trip",
  );
  assert.equal(trackingFailureKind(new Error("Unauthorized: Invalid token")), "session");
  assert.equal(trackingFailureKind(new Error("Connection unavailable")), "temporary");
});

test("missing tracking tables, columns and functions identify incomplete setup", () => {
  for (const code of ["PGRST205", "PGRST202", "42P01", "42703", "42883"]) {
    assert.match(trackingDatabaseError({ code }), /setup is incomplete/);
  }
});

test("tracking errors keep emergency calls available without exposing provider details", () => {
  for (const error of [
    null,
    undefined,
    "secret",
    { code: "42501", message: "private SQL" },
    new Error("credentials"),
  ]) {
    const message = trackingDatabaseError(error);
    assert.match(message, /Emergency call buttons still work/);
    assert.doesNotMatch(message, /secret|private SQL|credentials/);
    assert.match(message, /Please retry/);
  }
});
