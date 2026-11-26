import test from "node:test";
import assert from "node:assert/strict";
import { hazardZonesOnRoute } from "../../frontend/src/lib/hazard-zones.ts";

test("route segments detect seeded zones between vertices without matching nearby roads outside the radius", () => {
  const zone = {
    id: "fixture",
    label: "Fixture junction",
    lat: 15.45,
    lng: 73.86,
    radius_meters: 60,
    kind: "accident",
    description: "",
    source_url: "",
  };
  const crossing = [
    { lat: zone.lat, lng: zone.lng - 0.004 },
    { lat: zone.lat, lng: zone.lng + 0.004 },
  ];
  assert.deepEqual(hazardZonesOnRoute(crossing, [zone]), [zone]);
  assert.deepEqual(
    hazardZonesOnRoute(
      crossing.map((point) => ({ ...point, lat: point.lat + 0.001 })),
      [zone],
    ),
    [],
  );
  assert.deepEqual(hazardZonesOnRoute(crossing.slice(0, 1), [zone]), []);
});
