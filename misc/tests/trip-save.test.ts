import test from "node:test";
import assert from "node:assert/strict";
import { saveTripAtomically } from "../../frontend/src/lib/trip-save.ts";

const args = {
  _trip: { traveller_name: "Test", days: 3 },
  _travellers: [{ name: "Companion" }],
  _trip_id: "trip-id",
};
test("trip edits and companions are sent in one transactional call", async () => {
  let calls = 0;
  const result = await saveTripAtomically(
    {
      rpc: async (name, input) => {
        calls++;
        assert.equal(name, "save_trip_with_travellers");
        assert.deepEqual(input, args);
        return { data: "trip-id", error: null };
      },
    },
    args,
  );
  assert.equal(result, "trip-id");
  assert.equal(calls, 1);
});
test("missing migration and database failures never trigger a destructive fallback", async () => {
  let calls = 0;
  await assert.rejects(
    saveTripAtomically(
      {
        rpc: async () => {
          calls++;
          return { data: null, error: { code: "PGRST202", message: "Missing function" } };
        },
      },
      args,
    ),
    /existing trip has not been changed/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    saveTripAtomically(
      { rpc: async () => ({ data: null, error: { message: "Age category mismatch" } }) },
      args,
    ),
    /Age category mismatch/,
  );
  await assert.rejects(
    saveTripAtomically({ rpc: async () => ({ data: null, error: null }) }, args),
    /could not be saved/,
  );
});
