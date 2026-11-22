import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { auditedTables, classifyRead } from "./rls-audit.mjs";
const envFile = fileURLToPath(new URL("../../frontend/.env", import.meta.url));
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Supabase URL/publishable key is not configured.");
  process.exit(1);
}
console.log("Anonymous, read-only exposure audit:", new URL(url).hostname);
console.log(
  "Bucket list uses saved_places; no separate bucket_list table is queried by this app.",
);
const headers = { apikey: key };
if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
let failed = false;
for (const table of auditedTables) {
  try {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    const result = classifyRead(table, response.status, await response.json());
    console.log(`[${table}] ${result.kind}: ${result.message}`);
    if (["missing", "leak", "error"].includes(result.kind)) failed = true;
  } catch {
    console.error(`[${table}] Request failed; security could not be verified.`);
    failed = true;
  }
}
console.log(
  "This audit does not certify RLS. Verify enabled RLS and own-row policies using the SQL checks and two authenticated test accounts.",
);
process.exitCode = failed ? 1 : 2; // 2 explicitly means policy verification remains incomplete.
