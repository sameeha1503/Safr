import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "../../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";

const envFile = fileURLToPath(new URL("../../frontend/.env", import.meta.url));
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("Supabase URL, publishable key and service-role key are required.");
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const stamp = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const password = `Safr-RLS-${crypto.randomBytes(18).toString("base64url")}!`;
const users = [];

async function createTestClient(label) {
  const email = `safr-rls-${label}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { purpose: "temporary-rls-verification" },
  });
  if (error || !data.user) throw error || new Error("Test user was not created");
  users.push(data.user.id);
  const client = createClient(url, anonKey, options);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return { client, id: data.user.id };
}

async function insert(table, row) {
  const result = await admin.from(table).insert(row).select("id").single();
  if (result.error) throw new Error(`${table} fixture: ${result.error.message}`);
  return result.data.id;
}

async function assertOwnerOnly(table, id, owner, stranger) {
  const own = await owner.from(table).select("id").eq("id", id);
  if (own.error || own.data?.length !== 1)
    throw new Error(`${table}: owner could not read the fixture`);
  const other = await stranger.from(table).select("id").eq("id", id);
  if (other.error || other.data?.length !== 0)
    throw new Error(`${table}: cross-account read was not denied`);
  console.log(`${table}: owner read allowed; cross-account read denied.`);
}

try {
  const a = await createTestClient("a");
  const b = await createTestClient("b");
  const tripId = await insert("trips", {
    user_id: a.id,
    traveller_name: "RLS Test Owner",
    destination: "Panaji",
    days: 1,
  });
  const travellerId = await insert("travellers", {
    trip_id: tripId,
    user_id: a.id,
    name: "RLS Test Traveller",
    age: 30,
    category: "adult",
  });
  const fixtures = {
    trips: tripId,
    travellers: travellerId,
    itineraries: await insert("itineraries", {
      user_id: a.id,
      place: "RLS Test",
      plan: { title: "test", overview: "test", stops: [], tips: [] },
    }),
    saved_places: await insert("saved_places", {
      user_id: a.id,
      place_name: `RLS Test ${stamp}`,
    }),
    saved_routes: await insert("saved_routes", {
      user_id: a.id,
      name: "RLS Test Route",
      origin: { lat: 15.49, lng: 73.82 },
      destination: { lat: 15.5, lng: 73.83 },
    }),
    safety_tags: await insert("safety_tags", {
      user_id: a.id,
      person_name: "RLS Test",
      person_age: 30,
      category: "adult",
      guardian_name: "RLS Guardian",
      guardian_phone: "919999999999",
    }),
  };
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  fixtures.location_links = await insert("location_links", {
    owner_id: a.id,
    trip_id: tripId,
    traveller_id: travellerId,
    phone_number: "919999999998",
    status: "accepted",
    invite_expires_at: expiry,
    share_expires_at: expiry,
  });
  fixtures.trip_meeting_points = await insert("trip_meeting_points", {
    trip_id: tripId,
    created_by: a.id,
    title: "RLS Test Point",
    lat: 15.49,
    lng: 73.82,
  });
  fixtures.sos_incidents = await insert("sos_incidents", {
    trip_id: tripId,
    triggered_by_type: "guardian",
    triggered_by_id: a.id,
    sender_name: "RLS Test Owner",
    status: "resolved",
  });

  for (const [table, id] of Object.entries(fixtures))
    await assertOwnerOnly(table, id, a.client, b.client);

  const spoof = await b.client.from("saved_places").insert({
    user_id: a.id,
    place_name: `RLS Spoof ${stamp}`,
  });
  if (!spoof.error) throw new Error("saved_places: cross-account insert was allowed");
  console.log("saved_places: cross-account insert denied.");
  console.log("Authenticated two-account RLS verification passed.");
} finally {
  for (const id of users.reverse()) {
    const deleted = await admin.auth.admin.deleteUser(id);
    if (deleted.error)
      console.error(`Temporary user cleanup failed for ${id}: ${deleted.error.message}`);
  }
}
