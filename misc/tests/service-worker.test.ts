import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../frontend/public/sw.js", import.meta.url), "utf8");

test("service worker removes only obsolete Safr caches", async () => {
  const deleted: string[] = [];
  let activate: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void;
  runInNewContext(source, {
    self: {
      addEventListener: (name: string, handler: typeof activate) => {
        if (name === "activate") activate = handler;
      },
      clients: { claim: async () => {} },
    },
    caches: {
      keys: async () => [
        "safr-emergency-cache-v2",
        "safr-emergency-cache-v3",
        "safr-emergency-cache-old",
        "another-app-cache",
      ],
      delete: async (name: string) => {
        deleted.push(name);
      },
    },
  });
  let completion: Promise<unknown> | undefined;
  activate!({
    waitUntil: (promise) => {
      completion = promise;
    },
  });
  await completion;
  assert.deepEqual(deleted, ["safr-emergency-cache-v2", "safr-emergency-cache-old"]);
});

test("private navigations never enter the cache and offline uses only generic fallback", async () => {
  let handle: (event: {
    request: { url: string; method: string; mode: string };
    respondWith: (promise: Promise<unknown>) => void;
  }) => void;
  let offline = false;
  const matched: string[] = [];
  const response = { ok: true };
  runInNewContext(source, {
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async () => {
      if (offline) throw new Error("offline");
      return response;
    },
    self: {
      location: { origin: "https://safr.test" },
      addEventListener: (name: string, listener: typeof handle) => {
        if (name === "fetch") handle = listener;
      },
    },
    caches: {
      open: () => assert.fail("Private navigation must not be cached"),
      match: async (key: string) => {
        matched.push(key);
        return "offline page";
      },
    },
  });
  for (const path of ["/map", "/share/private-token", "/itinerary"]) {
    let result: Promise<unknown> | undefined;
    const event = {
      request: { url: `https://safr.test${path}`, method: "GET", mode: "navigate" },
      respondWith: (promise: Promise<unknown>) => {
        result = promise;
      },
    };
    offline = false;
    handle!(event);
    assert.equal(await result, response);
    offline = true;
    handle!(event);
    assert.equal(await result, "offline page");
  }
  assert.deepEqual(matched, ["/offline.html", "/offline.html", "/offline.html"]);
});

test("service worker leaves external, POST and server requests alone", () => {
  let handleFetch: (event: {
    request: { url: string; method: string };
    respondWith: () => void;
  }) => void;
  runInNewContext(source, {
    URL,
    self: {
      location: { origin: "https://safr.test" },
      addEventListener: (name: string, handler: typeof handleFetch) => {
        if (name === "fetch") handleFetch = handler;
      },
    },
  });
  for (const [url, method] of [
    ["https://tiles.test/tile", "GET"],
    ["https://safr.test/explore", "POST"],
    ["https://safr.test/_server/test", "GET"],
    ["https://safr.test/api/alert", "GET"],
  ]) {
    handleFetch!({
      request: { url: url!, method: method! },
      respondWith: () => assert.fail("Request should bypass the worker"),
    });
  }
});
