import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../../frontend/src/lib/rate-limiter.server.ts";
import { getCached, setCached } from "../../frontend/src/lib/place-cache.server.ts";

test("sliding limiter isolates users, retries accurately and expires at the boundary", () => {
  let now = 0;
  const limiter = createRateLimiter({ windowMs: 10000, max: 2, clock: () => now });
  assert.equal(limiter.check("a").allowed, true);
  now = 1000;
  assert.equal(limiter.check("a").allowed, true);
  assert.deepEqual(limiter.check("a"), { allowed: false, retryAfterSec: 9 });
  assert.equal(limiter.check("b").allowed, true);
  now = 10000;
  assert.equal(limiter.check("a").allowed, true);
  assert.deepEqual(limiter.check("a"), { allowed: false, retryAfterSec: 1 });
  now = 21000;
  assert.equal(limiter.check("a").allowed, true);
});
test("cache works without a database and expires without calling the network", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("No real network in tests"); });
  const previous = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
  t.after(() => { if (previous) process.env["SUPABASE_SERVICE_ROLE_KEY"] = previous; });
  assert.equal(await getCached("missing-test-key"), null);
  await setCached("test-value", { name: "Goa" }, 10);
  assert.deepEqual(await getCached("test-value"), { name: "Goa" });
  await setCached("test-expired", { name: "Goa" }, -1);
  assert.equal(await getCached("test-expired"), null);
});
