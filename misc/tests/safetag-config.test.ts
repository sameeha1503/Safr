import test from "node:test";
import assert from "node:assert/strict";
import { handleTagAlertRequest } from "../../frontend/src/lib/safetag.server";
test("SafeTag reports missing admin configuration without querying or exposing secrets", async (t) => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  t.after(() => {
    if (previous !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new Error("No network permitted");
  });
  const result = await handleTagAlertRequest(
    new Request("https://safr.test/alert", { method: "POST", body: "{}" }),
    "CONFIG-TEST",
  );
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /temporarily unavailable/);
  assert.equal(calls, 0);
});
