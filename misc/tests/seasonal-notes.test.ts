import test from "node:test";
import assert from "node:assert/strict";
import { CURATED_GOA_PLACES } from "../../frontend/src/lib/goa-places-data.ts";

test("verified seasonal guidance covers curated beaches and water activities", () => {
  const seasonal = CURATED_GOA_PLACES.filter(
    (place) =>
      place.kind === "beach" ||
      place.kind === "water_sports" ||
      place.id === "curated/dudhsagar_falls",
  );
  assert.equal(seasonal.length, 13);
  for (const place of seasonal) {
    assert.ok(place.seasonNotes?.length, `${place.name} needs a verified note`);
    assert.match(place.seasonNotes![0]!, /check|confirm/i);
  }
});
