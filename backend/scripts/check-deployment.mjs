// Read-only schema/configuration audit. Does not send messages or request user rows.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { notificationReadiness } from "../../frontend/src/lib/notification-config.ts";
const envFile = fileURLToPath(new URL("../../frontend/.env", import.meta.url));
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Configure the server Supabase URL and service-role key.");
  process.exitCode = 1;
} else {
  const headers = { apikey: key };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const probes = [
    [
      "saved_places",
      "id,status,visited_at,priority,planned_date,tags,updated_at",
    ],
    ["saved_routes", "id,user_id,name,mode,origin,destination,waypoints"],
    ["place_cache", "key,payload,expires_at,created_at"],
    ["crowd_reports", "id,user_id,place_key,level,created_at"],
  ];
  await Promise.all(
    probes.map(async ([table, columns]) => {
      try {
        const response = await fetch(
          `${url}/rest/v1/${table}?select=${columns}&limit=0`,
          { headers, signal: AbortSignal.timeout(6000) },
        );
        if (response.ok) console.log(`${table}: expected columns available.`);
        else {
          console.error(
            `${table}: database check failed (HTTP ${response.status}); apply backend/supabase/repairs/20261024_explore_routes_cache_crowd.sql.`,
          );
          process.exitCode = 1;
        }
      } catch {
        console.error(
          `${table}: connection failed; availability could not be verified.`,
        );
        process.exitCode = 1;
      }
    }),
  );
}
const notifications = notificationReadiness(process.env);
for (const issue of notifications.issues)
  console.error(`Notifications: ${issue}`);
if (!notifications.ready) process.exitCode = 1;
else
  console.log(
    "Notifications: live settings configured; delivery still requires an explicit test with an approved recipient.",
  );
console.log(
  "No messages sent. This check does not certify RLS, credentials, or provider delivery.",
);
