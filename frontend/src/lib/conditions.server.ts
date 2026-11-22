import { z } from "zod";
import { fetchJson } from "./places.server";
import type { PlaceConditions } from "./conditions";

const number = z
  .number()
  .finite()
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const forecastSchema = z.object({
  current: z
    .object({
      time: text,
      temperature_2m: number,
      apparent_temperature: number,
      precipitation: number,
      wind_speed_10m: number,
      weather_code: number,
    })
    .nullable()
    .optional(),
  daily: z
    .object({
      sunrise: z.array(text).nullable().optional(),
      sunset: z.array(text).nullable().optional(),
      uv_index_max: z.array(number).nullable().optional(),
      precipitation_probability_max: z.array(number).nullable().optional(),
    })
    .nullable()
    .optional(),
});
const marineSchema = z.object({
  current: z
    .object({
      time: text,
      wave_height: number,
      wave_period: number,
      wave_direction: number,
      swell_wave_height: number,
    })
    .nullable()
    .optional(),
});
const cache = new Map<string, { expires: number; data: PlaceConditions }>();
export async function fetchConditions({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): Promise<PlaceConditions | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone: "Asia/Kolkata",
  });
  const [forecast, sea] = await Promise.all([
    fetchJson(
      `https://api.open-meteo.com/v1/forecast?${params}&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code&daily=sunrise,sunset,uv_index_max,precipitation_probability_max&forecast_days=1`,
      {},
      6000,
    )
      .then((value) => forecastSchema.safeParse(value))
      .catch(() => null),
    fetchJson(
      `https://marine-api.open-meteo.com/v1/marine?${params}&current=wave_height,wave_period,wave_direction,swell_wave_height`,
      {},
      6000,
    )
      .then((value) => marineSchema.safeParse(value))
      .catch(() => null),
  ]);
  const f = forecast?.success ? forecast.data : null;
  const m = sea?.success ? sea.data.current : null;
  const weather: PlaceConditions["weather"] = f
    ? {
        temperature: f.current?.temperature_2m ?? null,
        feelsLike: f.current?.apparent_temperature ?? null,
        precipitation: f.current?.precipitation ?? null,
        wind: f.current?.wind_speed_10m ?? null,
        weatherCode: f.current?.weather_code ?? null,
        rainChance: f.daily?.precipitation_probability_max?.[0] ?? null,
        uv: f.daily?.uv_index_max?.[0] ?? null,
        sunrise: f.daily?.sunrise?.[0] ?? null,
        sunset: f.daily?.sunset?.[0] ?? null,
      }
    : null;
  const marine: PlaceConditions["marine"] = m
    ? {
        waveHeight: m.wave_height,
        wavePeriod: m.wave_period,
        waveDirection: m.wave_direction,
        swellHeight: m.swell_wave_height,
      }
    : null;
  const hasWeather =
    weather && Object.values(weather).some((value) => value != null);
  const hasMarine =
    marine && Object.values(marine).some((value) => value != null);
  if (!hasWeather && !hasMarine) return null;
  const data: PlaceConditions = {
    updatedAt: f?.current?.time || m?.time || null,
    weather: hasWeather ? weather : null,
    marine: hasMarine ? marine : null,
  };
  for (const [id, entry] of cache)
    if (entry.expires <= Date.now()) cache.delete(id);
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + 600000, data });
  return data;
}
