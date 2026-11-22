import { z } from "zod";
export const roadReportInput = z.object({
  lat: z.number().min(14.8).max(15.9),
  lng: z.number().min(73.6).max(74.4),
  kind: z.enum(["closure", "flooding", "roadworks", "obstruction"]),
  detail: z.string().trim().min(10).max(300),
});
export type RoadReportInput = z.infer<typeof roadReportInput>;
export type RoadReport = RoadReportInput & {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  expires_at: string;
};
// Visibility is actually enforced via the road_reports_read RLS policy in the backend; this function must be kept in sync with that policy if ever reintroduced/used directly.
export function isVisibleRoadReport(
  report: RoadReport,
  userId: string,
  now: number,
) {
  return (
    Date.parse(report.expires_at) > now &&
    (report.status === "approved" || report.user_id === userId)
  );
}
