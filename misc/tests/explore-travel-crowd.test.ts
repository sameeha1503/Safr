import test from "node:test";
import assert from "node:assert/strict";
import { aggregateCrowd, makePlaceKey } from "../../frontend/src/lib/crowd.ts";
import { loadTravelTimes } from "../../frontend/src/lib/explore-travel.server.ts";
import { nearbyEssentials } from "../../frontend/src/lib/places.server.ts";

test("place keys normalize names and round coordinates consistently", () => {
  assert.equal(makePlaceKey("Bága Beach", 15.5553, 73.7517), "baga@15.56,73.75");
  assert.equal(makePlaceKey("Chapora Fort", 15.6059, 73.7388), makePlaceKey("Chapora", 15.606, 73.739));
});
test("crowd requires distinct recent users, ignores future/stale votes and uses latest per user", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const first = { user_id: "a", level: "quiet" as const, created_at: "2026-10-11T11:00:00Z" };
  assert.deepEqual(aggregateCrowd([first, { ...first, level: "packed" }], now), { band: null });
  const second = { user_id: "b", level: "busy" as const, created_at: "2026-10-11T11:50:00Z" };
  const crowd = aggregateCrowd([first, second, { ...first, level: "moderate", created_at: "2026-10-11T11:30:00Z" }, { user_id: "c", level: "packed", created_at: "2026-10-11T10:30:00Z" }, { user_id: "d", level: "packed", created_at: "2026-10-11T13:00:00Z" }], now);
  assert.deepEqual(crowd, { band: "busy", count: 2, lastReportAt: second.created_at.replace("Z", ".000Z") });
});
test("road times handle unreachable snaps and null cells, and fail soft", async t => {
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.ok(init.signal);
    return Response.json({ code: "Ok", sources: [{ distance: 1 }, { distance: 2 }, { distance: 1500 }], durations: [[0, 300, 600], [300, 0, 300], [600, 300, 0]], distances: [[0, 2000, 4000], [2000, 0, 2000], [4000, 2000, 0]] });
  });
  assert.deepEqual(await loadTravelTimes({ lat: 15, lng: 74 }, [{ lat: 15.01, lng: 74 }, { lat: 15.02, lng: 74 }]), [{ minutes: 5, km: 2 }, null]);
  t.mock.method(globalThis, "fetch", async () => new Response("error", { status: 503 }));
  assert.deepEqual(await loadTravelTimes({ lat: 15, lng: 74 }, [{ lat: 15.01, lng: 74 }]), [null]);
});
test("essentials selects up to 3 nearest named items of each type and handles way centres", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ elements: [
    { type: "node", id: 1, lat: 15.201, lon: 73.901, tags: { name: "Near pharmacy", amenity: "pharmacy", opening_hours: "24/7" } },
    { type: "node", id: 2, lat: 15.22, lon: 73.92, tags: { name: "Far pharmacy", amenity: "pharmacy" } },
    { type: "way", id: 3, center: { lat: 15.202, lon: 73.902 }, tags: { name: "Hospital", amenity: "hospital" } },
    { type: "node", id: 4, lat: 15.2, lon: 73.9, tags: { amenity: "police" } },
  ] }));
  const result = await nearbyEssentials({ lat: 15.2, lng: 73.9 });
  assert.equal(result?.length, 3);
  const pharmacies = result?.filter(item => item.kind === "pharmacy");
  assert.equal(pharmacies?.length, 2);
  assert.equal(pharmacies?.[0]?.name, "Near pharmacy");
  assert.equal(pharmacies?.[1]?.name, "Far pharmacy");
  assert.equal(result?.find(item => item.kind === "hospital")?.lat, 15.202);
});
test("essentials ignores items with junk names", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ elements: [
    { type: "node", id: 10, lat: 15.401, lon: 73.801, tags: { name: "unknown", amenity: "hospital" } },
    { type: "node", id: 11, lat: 15.402, lon: 73.802, tags: { name: "https://junk-pharmacy.com", amenity: "pharmacy" } },
    { type: "node", id: 12, lat: 15.403, lon: 73.803, tags: { name: "City Hospital", amenity: "hospital" } },
  ] }));
  const result = await nearbyEssentials({ lat: 15.4, lng: 73.8 });
  assert.equal(result?.length, 1);
  assert.equal(result?.[0]?.name, "City Hospital");
});
