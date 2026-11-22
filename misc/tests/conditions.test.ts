import test from "node:test";
import assert from "node:assert/strict";
import { deriveAdvisories } from "../../frontend/src/lib/conditions-advice.ts";
import type { PlaceConditions } from "../../frontend/src/lib/conditions.ts";
import { fetchConditions } from "../../frontend/src/lib/conditions.server.ts";

const now = new Date("2026-10-11T10:00:00Z");
function conditions(wave: number, uv = 0, rain = 0): PlaceConditions {
  return { updatedAt: null, weather: { temperature: null, feelsLike: null, precipitation: null, wind: null, weatherCode: null, rainChance: rain, uv, sunrise: null, sunset: null }, marine: { waveHeight: wave, wavePeriod: null, waveDirection: null, swellHeight: null } };
}
test("conditions guidance uses inclusive documented boundaries and requires data", () => {
  assert.deepEqual(deriveAdvisories(null, { kind: "beach", now: new Date("2026-07-11") }), []);
  assert.deepEqual(deriveAdvisories(conditions(1.49, 7.99, 69.99), { now }), []);
  assert.equal(deriveAdvisories(conditions(1.5), { now })[0]?.severity, "medium");
  assert.equal(deriveAdvisories(conditions(2.5), { now })[0]?.severity, "high");
  assert.equal(deriveAdvisories(conditions(0, 8, 70), { now }).length, 2);
  assert.equal(deriveAdvisories(conditions(0), { kind: "beach", now: new Date("2026-06-01") }).length, 1);
  assert.equal(deriveAdvisories(conditions(0), { kind: "museum", now: new Date("2026-06-01") }).length, 0);
});
test("forecast fixtures tolerate nullable inland marine data and cache for ten minutes", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls++;
    assert.ok(init.signal);
    return String(url).includes("marine-api") ? Response.json({ current: { wave_height: null, wave_period: null, wave_direction: null, swell_wave_height: null } }) : Response.json({ current: { time: "2026-10-11T12:00", temperature_2m: 30, apparent_temperature: null, precipitation: 0, wind_speed_10m: 10, weather_code: 0 }, daily: { sunrise: ["2026-10-11T06:20"], sunset: ["2026-10-11T18:20"], uv_index_max: [8], precipitation_probability_max: [70] } });
  });
  const result = await fetchConditions({ lat: 15.44, lng: 74.15 });
  assert.equal(result?.weather?.temperature, 30);
  assert.equal(result?.weather?.feelsLike, null);
  assert.equal(result?.marine, null);
  await fetchConditions({ lat: 15.44, lng: 74.15 });
  assert.equal(calls, 2);
});
test("conditions fail soft for malformed and unavailable APIs", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 500 }));
  assert.equal(await fetchConditions({ lat: 15.1, lng: 74.1 }), null);
  t.mock.method(globalThis, "fetch", async () => Response.json({ current: { wave_height: "unknown" } }));
  assert.equal(await fetchConditions({ lat: 15.12, lng: 74.12 }), null);
});
