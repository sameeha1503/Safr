import { z } from "zod";

const numbers = z.array(z.number().finite());
const times = z.array(z.string().min(1));
const currentSchema = z.object({
  time: z.string().min(13),
  temperature_2m: z.number().finite(),
  relative_humidity_2m: z.number().finite(),
  wind_speed_10m: z.number().finite(),
  weather_code: z.number().finite(),
  is_day: z.number().finite(),
});
const dailySchema = z
  .object({
    time: times,
    weather_code: numbers,
    temperature_2m_max: numbers,
    temperature_2m_min: numbers,
    precipitation_probability_max: numbers,
    uv_index_max: numbers,
  })
  .refine((day) =>
    Object.values(day).every((values) => values.length === day.time.length),
  );
const hourlySchema = z
  .object({
    time: times,
    temperature_2m: numbers,
    precipitation_probability: numbers,
    weather_code: numbers,
  })
  .refine((hour) =>
    Object.values(hour).every((values) => values.length === hour.time.length),
  );

export interface WidgetWeather {
  current: z.infer<typeof currentSchema>;
  daily?: z.infer<typeof dailySchema>;
  hourly?: z.infer<typeof hourlySchema>;
}

/** Missing or partial forecasts are hidden rather than presented as zero values. */
export function parseWidgetWeather(input: unknown): WidgetWeather | null {
  const envelope = z
    .object({
      current: currentSchema,
      daily: z.unknown().optional(),
      hourly: z.unknown().optional(),
    })
    .safeParse(input);
  if (!envelope.success) return null;
  const daily = dailySchema.safeParse(envelope.data.daily);
  const hourly = hourlySchema.safeParse(envelope.data.hourly);
  return {
    current: envelope.data.current,
    ...(daily.success ? { daily: daily.data } : {}),
    ...(hourly.success ? { hourly: hourly.data } : {}),
  };
}
