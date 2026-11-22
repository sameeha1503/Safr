import test from "node:test";
import assert from "node:assert/strict";
import { fetchOverpass } from "../../frontend/src/lib/places.server";
test("Overpass retries a configured mirror on failure, carrying a timeout and User-Agent", async (t) => {
  const oldPrimary = process.env.OVERPASS_URL,
    oldFallback = process.env.OVERPASS_FALLBACK_URL;
  process.env.OVERPASS_URL = "https://primary.invalid/api";
  process.env.OVERPASS_FALLBACK_URL = "https://mirror.invalid/api";
  t.after(() => {
    for (const [key, value] of [
      ["OVERPASS_URL", oldPrimary],
      ["OVERPASS_FALLBACK_URL", oldFallback],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  });
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push(url);
    assert.ok(init.signal);
    assert.ok(new Headers(init.headers).get("User-Agent"));
    return url.includes("primary.invalid")
      ? new Response("busy", { status: 429 })
      : Response.json({ elements: [] });
  });
  assert.deepEqual(await fetchOverpass("test"), { elements: [] });
  assert.equal(calls.length, 2);
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  await assert.rejects(fetchOverpass("test"), /temporarily unavailable/);
});
