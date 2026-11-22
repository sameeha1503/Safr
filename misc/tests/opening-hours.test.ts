import test from "node:test";
import assert from "node:assert/strict";
import { parseOpeningHours } from "../../frontend/src/features/map/lib/opening-hours";
import {
  classifyPlace,
  featureToPickedPlace,
  kindToCategory,
} from "../../frontend/src/features/map/lib/place-picking";

test("opening-hours: 24/7 is parsed as open", () => {
  const res = parseOpeningHours("24/7");
  assert.equal(res.isOpen, true);
  assert.equal(res.statusBadge, "Open 24/7");
  assert.equal(res.raw, "24/7");
});

test("opening-hours: daily hours evaluate correctly against simulated time", () => {
  // Test Monday at 12:00 IST (UTC 06:30)
  const noonIST = new Date("2026-10-05T06:30:00Z");
  const resOpen = parseOpeningHours("09:00-18:00", noonIST);
  assert.equal(resOpen.isOpen, true);
  assert.equal(resOpen.statusBadge, "Open");
  assert.equal(resOpen.statusDetail, "Closes at 18:00");

  // Test Monday at 21:00 IST (UTC 15:30)
  const nightIST = new Date("2026-10-05T15:30:00Z");
  const resClosed = parseOpeningHours("09:00-18:00", nightIST);
  assert.equal(resClosed.isOpen, false);
  assert.equal(resClosed.statusBadge, "Closed");
});

test("opening-hours: day range hours evaluate correctly", () => {
  // Monday at 12:00 IST
  const mondayNoon = new Date("2026-10-05T06:30:00Z");
  const resMoSa = parseOpeningHours("Mo-Sa 10:00-20:00", mondayNoon);
  assert.equal(resMoSa.isOpen, true);

  // Sunday at 12:00 IST (2026-10-11)
  const sundayNoon = new Date("2026-10-11T06:30:00Z");
  const resClosedSunday = parseOpeningHours("Mo-Sa 10:00-20:00", sundayNoon);
  assert.equal(resClosedSunday.isOpen, false);
  assert.equal(resClosedSunday.statusBadge, "Closed");
});

test("opening-hours: returns isOpen undefined for complex, irregular, or unsure rules", () => {
  // Semicolons / days off
  const r1 = parseOpeningHours("Tu-Su 10:00-18:00; Mo off");
  assert.equal(r1.isOpen, undefined);
  assert.equal(r1.statusBadge, undefined);
  assert.equal(r1.raw, "Tu-Su 10:00-18:00; Mo off");

  // Public holidays
  const r2 = parseOpeningHours("PH 10:00-14:00");
  assert.equal(r2.isOpen, undefined);

  // Comma split shifts
  const r3 = parseOpeningHours("10:00-14:00, 18:00-22:00");
  assert.equal(r3.isOpen, undefined);

  // Irregular strings
  const r4 = parseOpeningHours("sunrise to sunset");
  assert.equal(r4.isOpen, undefined);
  assert.equal(r4.raw, "sunrise to sunset");

  // Empty input
  const r5 = parseOpeningHours(null);
  assert.equal(r5.raw, "");
  assert.equal(r5.isOpen, undefined);
});

test("place-picking: classifies Goa places with appropriate kinds and icons", () => {
  const beach = classifyPlace("natural", "beach", "Calangute Beach");
  assert.equal(beach.kindLabel, "Beach");
  assert.equal(beach.iconKey, "Umbrella");

  const church = classifyPlace(
    "place_of_worship",
    "church",
    "Basilica of Bom Jesus",
  );
  assert.equal(church.kindLabel, "Church");
  assert.equal(church.iconKey, "Church");

  const fort = classifyPlace("historic", "castle", "Fort Aguada");
  assert.equal(fort.kindLabel, "Historic Fort / Monument");
  assert.equal(fort.iconKey, "Castle");

  const restaurant = classifyPlace("amenity", "restaurant", "Fisherman's Wharf");
  assert.equal(restaurant.kindLabel, "Restaurant");
  assert.equal(restaurant.iconKey, "Utensils");
});

test("place-picking: featureToPickedPlace parses features and builds stable id", () => {
  const feat = {
    properties: {
      name: "Baga Beach",
      subclass: "beach",
      osm_id: 123456,
    },
    geometry: {
      type: "Point",
      coordinates: [73.7517, 15.5553],
    },
    "source-layer": "poi",
  };

  const picked = featureToPickedPlace(feat);
  assert.ok(picked);
  assert.equal(picked?.name, "Baga Beach");
  assert.equal(picked?.kindLabel, "Beach");
  assert.equal(picked?.lat, 15.5553);
  assert.equal(picked?.lng, 73.7517);
  assert.equal(picked?.id, "poi:123456:15.55530,73.75170");

  assert.equal(kindToCategory("Beach"), "beach");
  assert.equal(kindToCategory("Restaurant"), "food");
  assert.equal(kindToCategory("Church"), "culture");
});
