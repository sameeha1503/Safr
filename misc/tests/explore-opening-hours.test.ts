import test from "node:test";
import assert from "node:assert/strict";
import {parseOpeningHours} from "../../frontend/src/lib/opening-hours";
test("weekly intervals, closing boundary and overnight carry use Kolkata time", () => {
  assert.equal(parseOpeningHours("Mo-Fr 09:00-18:00; Sa 10:00-14:00", new Date("2026-10-10T06:30:00Z")).isOpen, true);
  assert.equal(parseOpeningHours("Mo-Fr 09:00-18:00; Sa 10:00-14:00", new Date("2026-10-10T08:30:00Z")).isOpen, false);
  assert.equal(parseOpeningHours("Fr 22:00-02:00", new Date("2026-10-09T19:00:00Z")).isOpen, true);
  assert.equal(parseOpeningHours("Fr 22:00-02:00", new Date("2026-10-08T19:00:00Z")).isOpen, false);
});
test("ambiguous and invalid opening hours have no badge", () => {
  for (const raw of ["PH off", "Mo 09:00-18:00; Mo 10:00-20:00", "Mo-Su 09:00-24:30", "sunrise-sunset", "09:00-09:00"]) {
    assert.equal(parseOpeningHours(raw).isOpen, undefined);
    assert.equal(parseOpeningHours(raw).statusBadge, undefined);
  }
});
