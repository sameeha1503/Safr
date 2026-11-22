export const auditedTables = [
  "profiles",
  "trips",
  "travellers",
  "safety_tags",
  "itineraries",
  "emergency_contacts",
  "safety_tag_scans",
  "saved_places",
  "saved_routes",
  "location_links",
  "location_links_safe",
  "blocked_numbers",
  "location_audit",
  "place_cache",
  "crowd_reports",
  "road_reports",
  "trip_meeting_points",
  "sos_incidents",
];

// An empty anonymous read cannot prove RLS: the table itself may simply be empty.
export function classifyRead(table, status, body) {
  if (status === 404 || body?.code === "PGRST205" || body?.code === "42P01")
    return {
      kind: "missing",
      message:
        "Missing relation or unavailable API schema; apply/check migrations.",
    };
  if (status === 401 || status === 403)
    return {
      kind: "restricted",
      message:
        "Anonymous access rejected; authenticated policies still need verification.",
    };
  if (status >= 200 && status < 300 && Array.isArray(body)) {
    if (table === "emergency_contacts")
      return { kind: "public", message: "Public directory accessible." };
    return body.length
      ? {
          kind: "leak",
          message: "Sensitive rows are exposed to anonymous requests.",
        }
      : {
          kind: "inconclusive",
          message: "No rows exposed; empty data does not prove RLS is enabled.",
        };
  }
  return {
    kind: "error",
    message: `Unexpected HTTP ${status}; security could not be verified.`,
  };
}
