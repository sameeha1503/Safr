export interface PlaceConditions {
  updatedAt: string | null;
  weather: {
    temperature: number | null;
    feelsLike: number | null;
    precipitation: number | null;
    wind: number | null;
    weatherCode: number | null;
    rainChance: number | null;
    uv: number | null;
    sunrise: string | null;
    sunset: string | null;
  } | null;
  marine: {
    waveHeight: number | null;
    wavePeriod: number | null;
    waveDirection: number | null;
    swellHeight: number | null;
  } | null;
}
export interface Advisory {
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
}
export function formatGoaTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(
    /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}+05:30`,
  );
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      })
    : undefined;
}
