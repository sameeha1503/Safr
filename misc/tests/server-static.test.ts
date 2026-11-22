import test from "node:test";
import assert from "node:assert/strict";
import { staticResponseHeaders } from "../../frontend/server-static.mjs";
test("service worker revalidates and can control root while hashed assets stay immutable", () => {
  assert.deepEqual(staticResponseHeaders("/sw.js"), {
    "Cache-Control": "no-cache",
    "Service-Worker-Allowed": "/",
  });
  assert.match(staticResponseHeaders("/assets/index-abc.js")["Cache-Control"], /immutable/);
  assert.equal(staticResponseHeaders("/favicon.ico")["Service-Worker-Allowed"], undefined);
});
