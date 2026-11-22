import test from "node:test";
import assert from "node:assert/strict";
import { classifyRead, auditedTables } from "../../backend/scripts/rls-audit.mjs";
test("RLS audit never treats missing tables, failed requests or empty data as certified security", () => {
  assert.equal(classifyRead("saved_routes", 404, { code: "PGRST205" }).kind, "missing");
  assert.equal(classifyRead("saved_routes", 200, []).kind, "inconclusive");
  assert.equal(classifyRead("saved_routes", 200, [{ id: "private" }]).kind, "leak");
  assert.equal(classifyRead("place_cache", 403, {}).kind, "restricted");
  assert.equal(classifyRead("saved_routes", 500, {}).kind, "error");
  assert.equal(classifyRead("emergency_contacts", 200, [{ id: "public" }]).kind, "public");
  for (const name of ["saved_routes", "location_links", "place_cache", "crowd_reports"])
    assert.ok(auditedTables.includes(name));
});
