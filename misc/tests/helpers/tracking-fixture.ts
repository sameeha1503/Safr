import type { TestContext } from "node:test";
import { hashInviteToken } from "../../../frontend/src/lib/location-sharing-tokens.server.ts";
export const owner = "11111111-1111-4111-8111-111111111111",
  trip = "22222222-2222-4222-8222-222222222222",
  person = "33333333-3333-4333-8333-333333333333",
  link = "44444444-4444-4444-8444-444444444444";
export const token = "a".repeat(64);
export function trackingFixture(t: TestContext) {
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NOTIFY_MODE"];
  const previous = keys.map((key) => process.env[key]);
  process.env.SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-secret";
  process.env.NOTIFY_MODE = "mock";
  t.after(() =>
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    }),
  );
  const tables: Record<string, Record<string, unknown>[]> = {
    trips: [
      {
        id: trip,
        user_id: owner,
        traveller_name: "Guardian",
        destination: "Goa",
        phone_number: "9876543210",
      },
    ],
    travellers: [
      { id: person, user_id: owner, trip_id: trip, name: "Companion", phone_number: null },
    ],
    location_links: [
      {
        id: link,
        owner_id: owner,
        trip_id: trip,
        traveller_id: person,
        phone_number: null,
        status: "pending",
        invite_token_hash: hashInviteToken(token),
        invite_expires_at: new Date(Date.now() + 86400000).toISOString(),
        share_expires_at: new Date(Date.now() + 86400000).toISOString(),
        sharing_paused: true,
        last_lat: null,
        last_lng: null,
        last_accuracy: null,
        last_battery: null,
        last_seen_at: null,
        last_synced_at: null,
        created_at: new Date().toISOString(),
      },
    ],
    trip_meeting_points: [],
    sos_incidents: [],
  };
  const calls: { table: string; method: string; body: Record<string, unknown> | null }[] = [];
  const broadcasts: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input)),
      method = init?.method ?? "GET";
    if (!init?.signal) throw new Error("Outbound request missing timeout signal");
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.pathname === "/realtime/v1/api/broadcast") {
      broadcasts.push(body);
      return Response.json({});
    }
    const table = url.pathname.split("/").at(-1)!;
    if (!tables[table]) throw new Error(`Unexpected fixture URL: ${url.pathname}`);
    calls.push({ table, method, body });
    const matches = (row: Record<string, unknown>) =>
      [...url.searchParams.entries()].every(([field, filter]) => {
        if (filter === "is.null") return row[field] === null;
        if (filter.startsWith("eq.")) return String(row[field]) === filter.slice(3);
        if (filter.startsWith("gt.")) return String(row[field]) > filter.slice(3);
        if (filter.startsWith("in.("))
          return filter.slice(4, -1).split(",").includes(String(row[field]));
        return true;
      });
    let rows = tables[table]!.filter(matches);
    if (method === "PATCH") rows.forEach((row) => Object.assign(row, body));
    if (method === "POST") {
      const current =
        url.searchParams.get("on_conflict") === "trip_id"
          ? tables[table]!.find((row) => row["trip_id"] === body.trip_id)
          : undefined;
      if (current) {
        Object.assign(current, body);
        rows = [current];
      } else {
        const row = {
          id: "55555555-5555-4555-8555-555555555555",
          created_at: new Date().toISOString(),
          resolved_at: null,
          ...body,
        };
        tables[table]!.push(row);
        rows = [row];
      }
    }
    const select = url.searchParams.get("select");
    const selected = rows.map((row) =>
      select && select !== "*"
        ? Object.fromEntries(select.split(",").map((field) => [field, row[field]]))
        : { ...row },
    );
    const headers = new Headers(init?.headers);
    if (headers.get("accept")?.includes("vnd.pgrst.object"))
      return selected.length
        ? Response.json(selected[0])
        : Response.json({ code: "PGRST116", message: "No rows" }, { status: 406 });
    return Response.json(selected);
  });
  return { tables, calls, broadcasts };
}
