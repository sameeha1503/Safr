import type { Advisory, PlaceConditions } from "./conditions";

// Planning guidance thresholds, not official lifeguard flags or safety certifications.
export const MEDIUM_WAVE_METRES = 1.5;
export const HIGH_WAVE_METRES = 2.5;
export const HIGH_UV_INDEX = 8;
export const LIKELY_RAIN_PERCENT = 70;
export const MONSOON_MONTHS = [6, 7, 8, 9];
export function deriveAdvisories(
  conditions: PlaceConditions | null,
  { kind, now }: { kind?: string | undefined; now: Date },
): Advisory[] {
  if (!conditions || (!conditions.weather && !conditions.marine)) return [];
  const advice: Advisory[] = [];
  const wave = conditions.marine?.waveHeight;
  if (wave != null && wave >= MEDIUM_WAVE_METRES)
    advice.push({
      title: "General guidance: sea conditions",
      detail: `Forecast wave height is ${wave.toFixed(1)} m. Check lifeguard flags and local restrictions; this is not an official swimming warning.`,
      severity: wave >= HIGH_WAVE_METRES ? "high" : "medium",
    });
  const uv = conditions.weather?.uv;
  if (uv != null && uv >= HIGH_UV_INDEX)
    advice.push({
      title: "General guidance: sun exposure",
      detail: `Today's maximum UV index is ${uv}. Use shade and sun protection.`,
      severity: "medium",
    });
  const rain = conditions.weather?.rainChance;
  if (rain != null && rain >= LIKELY_RAIN_PERCENT)
    advice.push({
      title: "General guidance: rain",
      detail: `Today's forecast rain probability is ${rain}%. Allow for wet conditions and check access locally.`,
      severity: "low",
    });
  const month = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      month: "numeric",
    }).format(now),
  );
  if (
    MONSOON_MONTHS.includes(month) &&
    /beach|coast|surf|sea|island/i.test(kind || "")
  )
    advice.push({
      title: "General guidance: monsoon season",
      detail:
        "June–September is the monsoon period. Check lifeguard flags and local restrictions before coastal activities.",
      severity: "low",
    });
  return advice;
}
