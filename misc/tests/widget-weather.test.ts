import test from "node:test";
import assert from "node:assert/strict";
import { parseWidgetWeather } from "../../frontend/src/lib/widget-weather.ts";

const current = {
  time: "2026-10-12T12:00",
  temperature_2m: 28,
  relative_humidity_2m: 70,
  wind_speed_10m: 12,
  weather_code: 2,
  is_day: 1,
};
test("weather rejects missing current measurements and null temperatures", () => {
  assert.equal(parseWidgetWeather({ current: { ...current, temperature_2m: null } }), null);
  assert.equal(parseWidgetWeather({ current: { temperature_2m: 28 } }), null);
});
test("partial forecast arrays cannot become invented zero temperatures or clear skies", () => {
  assert.deepEqual(
    parseWidgetWeather({
      current,
      hourly: {
        time: ["2026-10-12T12:00"],
        temperature_2m: [],
        precipitation_probability: [0],
        weather_code: [0],
      },
      daily: null,
    }),
    { current },
  );
  const hourly = {
    time: ["2026-10-12T12:00"],
    temperature_2m: [0],
    precipitation_probability: [0],
    weather_code: [0],
  };
  assert.deepEqual(parseWidgetWeather({ current, hourly }), { current, hourly });
});
