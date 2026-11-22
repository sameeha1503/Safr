import test from "node:test";
import assert from "node:assert/strict";
import {resolvedCentre} from "../../frontend/src/lib/resolved-centre";
test("pre-resolved itinerary centre accepts valid numeric URLs and ignores incomplete or invalid pairs", () => {
  assert.deepEqual(resolvedCentre("15.5", "73.8"), {lat: 15.5, lng: 73.8});
  assert.deepEqual(resolvedCentre(0, 0), {lat: 0, lng: 0});
  for (const [lat, lng] of [[undefined, undefined], ["", "73"], [15, undefined], [NaN, 73], [91, 73], [15, 181]]) assert.equal(resolvedCentre(lat, lng), undefined);
});
