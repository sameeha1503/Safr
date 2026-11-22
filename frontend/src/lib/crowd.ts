import { normalizePlaceName } from "./place-names";
export const CROWD_LEVELS = ["quiet", "moderate", "busy", "packed"] as const;
export type CrowdLevel = (typeof CROWD_LEVELS)[number];
export interface CrowdReport {
  user_id: string;
  level: CrowdLevel;
  created_at: string;
}
export type CrowdSummary =
  { band: null } | { band: CrowdLevel; count: number; lastReportAt: string };
export function makePlaceKey(name: string, lat: number, lng: number): string {
  return `${normalizePlaceName(name).replace(/\s+/g, "-")}@${lat.toFixed(2)},${lng.toFixed(2)}`;
}
/** One latest vote per user within 90 minutes; even medians choose the upper level. */
export function aggregateCrowd(
  reports: readonly CrowdReport[],
  now: Date,
): CrowdSummary {
  const end = now.getTime();
  const users = new Map<string, CrowdReport>();
  for (const report of reports) {
    const time = Date.parse(report.created_at);
    if (
      !report.user_id ||
      !CROWD_LEVELS.includes(report.level) ||
      time > end ||
      time <= end - 90 * 60000 ||
      !Number.isFinite(time)
    )
      continue;
    const existing = users.get(report.user_id);
    if (!existing || time > Date.parse(existing.created_at))
      users.set(report.user_id, report);
  }
  if (users.size < 2) return { band: null };
  const votes = [...users.values()];
  const levels = votes
    .map((report) => CROWD_LEVELS.indexOf(report.level))
    .sort((a, b) => a - b);
  return {
    band: CROWD_LEVELS[levels[Math.floor(levels.length / 2)]!]!,
    count: users.size,
    lastReportAt: new Date(
      Math.max(...votes.map((report) => Date.parse(report.created_at))),
    ).toISOString(),
  };
}
