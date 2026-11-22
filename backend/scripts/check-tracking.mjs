// Read-only deployment check: zero rows requested, no credentials printed.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const envFile = fileURLToPath(new URL("../../frontend/.env", import.meta.url));
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Configure the server Supabase URL and credentials first.");
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing server-only SUPABASE_SERVICE_ROLE_KEY: Reunite cannot run.",
  );
  process.exitCode = 1;
}
const headers = { apikey: key };
if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
const probes = [
  ["trips", "id,phone_number"],
  ["travellers", "id,phone_number"],
  [
    "location_links",
    "id,invite_token_hash,last_synced_at,last_battery,sharing_paused",
  ],
  ["trip_meeting_points", "id,trip_id,title,notes,lat,lng,is_active"],
  ["sos_incidents", "id,trip_id,triggered_by_id,delivery_summary,status"],
];
await Promise.all(
  probes.map(async ([table, columns]) => {
    try {
      const response = await fetch(
        `${url}/rest/v1/${table}?select=${columns}&limit=0`,
        {
          headers,
          signal: AbortSignal.timeout(6000),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        const code = typeof body.code === "string" ? body.code : "unknown";
        const missing = ["PGRST205", "42P01", "42703"].includes(code);
        console.error(
          `${table}: ${missing ? "missing table/column; apply Reunite repair SQL" : "access or service failure"} (${response.status}).`,
        );
        process.exitCode = 1;
      } else console.log(`${table}: expected columns available.`);
    } catch (error) {
      const tls = error.cause?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
      console.error(
        `${table}: ${tls ? "certificate verification failed; configure a trusted CA (never disable TLS verification)" : "connection failed"}.`,
      );
      process.exitCode = 1;
    }
  }),
);
console.log(
  "This checks configuration and schema availability, not RLS or live delivery. Verify the trip-save function and two-device flow after applying the repair.",
);
