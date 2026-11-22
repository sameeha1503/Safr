import { supabaseAdmin as db } from "../integrations/supabase/client.server";
import { createRateLimiter } from "./rate-limiter.server";
import {
  hashInviteToken,
  makeInviteToken,
} from "./location-sharing-tokens.server";
import {
  isInviteValid,
  isFreshSample,
  shouldPersistLocation,
  sampleSchema,
  type TrackingLink,
  type GuardianState,
  type CompanionState,
  type LocationSample,
  type Incident,
} from "./companion-tracking";
import { sendEmergencyMessage, normalizeE164, maskPhone } from "./notifications.server";
import type { GuardianAction, CompanionAction } from "./tracking-actions";
import {
  trackingDatabaseError,
  TRACKING_SETUP_MESSAGE,
} from "./tracking-errors";
const limiter = createRateLimiter({ windowMs: 60000, max: 90 });
const publicLimiter = createRateLimiter({ windowMs: 60000, max: 1200 });
const invites = createRateLimiter({ windowMs: 600000, max: 30 });
const emergencyLimiter = createRateLimiter({ windowMs: 60000, max: 5 });
const timeout = () => AbortSignal.timeout(6000);
function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new Error(trackingDatabaseError(result.error));
  return result.data;
}
function required<T>(result: { data: T; error: unknown }): NonNullable<T> {
  const value = checked(result);
  if (value == null) throw new Error("Trip or companion no longer exists.");
  return value;
}
export function checkTrackingAccess(key: string) {
  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"])
    throw new Error(TRACKING_SETUP_MESSAGE);
  if (!(key.startsWith("ip:") ? publicLimiter : limiter).check(key).allowed)
    throw new Error("Too many updates. Wait a minute and retry.");
}
async function ownedTrip(user: string, tripId?: string) {
  let query = db
    .from("trips")
    .select("id,traveller_name,destination,phone_number")
    .eq("user_id", user);
  if (tripId) query = query.eq("id", tripId);
  const trip = checked(
    await query
      .order("created_at", { ascending: false })
      .limit(1)
      .abortSignal(timeout())
      .maybeSingle(),
  );
  if (!trip)
    throw new Error(
      "Set up a trip first, or select a trip that belongs to you.",
    );
  return trip;
}
async function tokenLink(token: string): Promise<TrackingLink> {
  const hash = hashInviteToken(token);
  const link = checked(
    await db
      .from("location_links")
      .select("*")
      .eq("invite_token_hash", hash)
      .abortSignal(timeout())
      .maybeSingle(),
  );
  if (!link || !isInviteValid(link))
    throw new Error(
      "This sharing link has expired or was revoked. Ask your guardian for a new invite.",
    );
  return link;
}
export async function broadcastTracking(
  tripId: string,
  payload: Record<string, unknown>,
  companionRooms: string[] = [],
) {
  const url = process.env["SUPABASE_URL"],
    key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return false;
  try {
    const headers: Record<string, string> = {
      apikey: key,
      "Content-Type": "application/json",
    };
    if (key.startsWith("eyJ")) headers["Authorization"] = `Bearer ${key}`;
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers,
      signal: timeout(),
      body: JSON.stringify({
        messages: [
          {
            topic: `trip_tracking_${tripId}`,
            event: "tracking",
            payload,
            private: true,
          },
          ...companionRooms.map((hash) => ({
            topic: `companion_${hash}`,
            event: "refresh",
            payload: { refresh: true },
            private: false,
          })),
        ],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
async function notifyTrip(tripId: string, payload: Record<string, unknown>) {
  try {
    const links = checked(
      await db
        .from("location_links")
        .select("*")
        .eq("trip_id", tripId)
        .in("status", ["pending", "accepted"])
        .abortSignal(timeout()),
    );
    return broadcastTracking(
      tripId,
      payload,
      (links ?? [])
        .filter((link) => isInviteValid(link))
        .map((link) => link.invite_token_hash!)
        .filter(Boolean),
    );
  } catch {
    return broadcastTracking(tripId, payload);
  }
}
async function tripDetails(tripId: string) {
  const trip = required(
    await db
      .from("trips")
      .select("id,traveller_name,destination,phone_number")
      .eq("id", tripId)
      .abortSignal(timeout())
      .single(),
  );
  return trip;
}
export async function getTrackingWorkspace(
  user: string,
  tripId?: string,
): Promise<GuardianState> {
  checkTrackingAccess(`user:${user}`);
  const trip = await ownedTrip(user, tripId);
  const [people, links, meeting, incidents] = await Promise.all([
    db
      .from("travellers")
      .select("id,name")
      .eq("trip_id", trip.id)
      .eq("user_id", user)
      .abortSignal(timeout()),
    db
      .from("location_links")
      .select("*")
      .eq("trip_id", trip.id)
      .eq("owner_id", user)
      .order("created_at", { ascending: false })
      .abortSignal(timeout()),
    db
      .from("trip_meeting_points")
      .select("*")
      .eq("trip_id", trip.id)
      .eq("is_active", true)
      .abortSignal(timeout())
      .maybeSingle(),
    db
      .from("sos_incidents")
      .select("*")
      .eq("trip_id", trip.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(50)
      .abortSignal(timeout()),
  ]);
  const travellers = checked(people) ?? [];
  const members = (checked(links) ?? []).map((link) => {
    const parsed = sampleSchema.safeParse({
      lat: link.last_lat,
      lng: link.last_lng,
      accuracy: link.last_accuracy,
      battery: link.last_battery,
      capturedAt: link.last_seen_at,
    });
    return {
      id: link.id,
      revision: link.invite_token_hash ?? "",
      name:
        travellers.find((person) => person.id === link.traveller_id)?.name ??
        "Companion",
      status: isInviteValid(link)
        ? link.status
        : ["pending", "accepted"].includes(link.status)
          ? "expired"
          : link.status,
      paused: link.sharing_paused,
      sample:
        isInviteValid(link) && !link.sharing_paused && parsed.success
          ? parsed.data
          : null,
    };
  });
  return {
    trip: { id: trip.id, name: trip.destination },
    travellers,
    members,
    meeting: checked(meeting),
    incidents: checked(incidents) ?? [],
  };
}
export async function verifyCompanionToken(
  token: string,
): Promise<CompanionState> {
  return loadCompanionState(await tokenLink(token));
}
async function loadCompanionState(link: TrackingLink): Promise<CompanionState> {
  const [trip, person, meeting, incidents] = await Promise.all([
    tripDetails(link.trip_id),
    db
      .from("travellers")
      .select("name")
      .eq("id", link.traveller_id)
      .eq("trip_id", link.trip_id)
      .abortSignal(timeout())
      .single(),
    db
      .from("trip_meeting_points")
      .select("*")
      .eq("trip_id", link.trip_id)
      .eq("is_active", true)
      .abortSignal(timeout())
      .maybeSingle(),
    db
      .from("sos_incidents")
      .select("id,sender_name,created_at,status")
      .eq("trip_id", link.trip_id)
      .eq("status", "active")
      .limit(50)
      .abortSignal(timeout()),
  ]);
  return {
    tripTitle: trip.destination,
    guardianName: trip.traveller_name,
    companionName: required(person).name,
    linkId: link.id,
    room: `companion_${link.invite_token_hash}`,
    meeting: checked(meeting),
    incidents: checked(incidents) ?? [],
  };
}
export async function generateCompanionInvite(
  user: string,
  tripId: string,
  travellerId: string,
) {
  if (!invites.check(user).allowed)
    throw new Error("Invite limit reached. Please wait ten minutes.");
  await ownedTrip(user, tripId);
  const person = required(
    await db
      .from("travellers")
      .select("id,name,phone_number")
      .eq("id", travellerId)
      .eq("trip_id", tripId)
      .eq("user_id", user)
      .abortSignal(timeout())
      .single(),
  );
  const phone = person.phone_number;
  const token = makeInviteToken(),
    hash = hashInviteToken(token),
    expiry = new Date(Date.now() + 86400000).toISOString();
  // One write rotates the capability and clears coordinates; old invites immediately stop working.
  const current = checked(
    await db
      .from("location_links")
      .select("id")
      .eq("traveller_id", travellerId)
      .in("status", ["pending", "accepted"])
      .abortSignal(timeout())
      .maybeSingle(),
  );
  const values = {
    owner_id: user,
    trip_id: tripId,
    traveller_id: travellerId,
    phone_number: phone,
    status: "pending",
    invite_token_hash: hash,
    invite_expires_at: expiry,
    share_expires_at: expiry,
    sharing_paused: true,
    last_lat: null,
    last_lng: null,
    last_accuracy: null,
    last_battery: null,
    last_seen_at: null,
    last_synced_at: null,
  };
  if (current)
    checked(
      await db
        .from("location_links")
        .update(values)
        .eq("id", current.id)
        .eq("owner_id", user)
        .abortSignal(timeout()),
    );
  else
    checked(
      await db.from("location_links").insert(values).abortSignal(timeout()),
    );
  await broadcastTracking(tripId, { kind: "refresh" });
  return { path: `/share/${token}`, expiresAt: expiry, name: person.name };
}
export async function updateCompanionLocation(
  token: string,
  sample: LocationSample,
) {
  return publishLocation(token, sample, await tokenLink(token));
}
async function publishLocation(
  token: string,
  sample: LocationSample,
  link: TrackingLink,
) {
  if (!isFreshSample(sample))
    throw new Error("Waiting for a fresh GPS fix. Keep this page open.");
  const now = new Date().toISOString();
  let persist =
    link.sharing_paused ||
    link.status !== "accepted" ||
    shouldPersistLocation(link.last_synced_at);
  if (persist) {
    let write = db
      .from("location_links")
      .update({
        status: "accepted",
        sharing_paused: false,
        last_lat: sample.lat,
        last_lng: sample.lng,
        last_accuracy: sample.accuracy,
        last_battery: sample.battery,
        last_seen_at: sample.capturedAt,
        last_synced_at: now,
      })
      .eq("id", link.id)
      .eq("invite_token_hash", hashInviteToken(token))
      .in("status", ["pending", "accepted"])
      .gt("invite_expires_at", now);
    // Compare-and-set also throttles concurrent requests handled by different server instances.
    write = link.last_synced_at
      ? write.eq("last_synced_at", link.last_synced_at)
      : write.is("last_synced_at", null);
    const updated = checked(
      await write.select("id").abortSignal(timeout()).maybeSingle(),
    );
    if (!updated) {
      await tokenLink(token);
      persist = false;
    }
  }
  const person = required(
    await db
      .from("travellers")
      .select("name")
      .eq("id", link.traveller_id)
      .abortSignal(timeout())
      .single(),
  );
  const realtime = await broadcastTracking(link.trip_id, {
    kind: "location",
    member: {
      id: link.id,
      revision: link.invite_token_hash ?? "",
      name: person.name.slice(0, 100),
      status: "accepted",
      paused: false,
      sample,
    },
  });
  return { persisted: persist, realtime };
}
async function recordSos(
  trip: Awaited<ReturnType<typeof tripDetails>>,
  actor: { id: string; role: "guardian" | "companion"; name: string },
  point: { lat: number; lng: number; accuracy: number | null } | null,
) {
  if (!emergencyLimiter.check(`${trip.id}:${actor.id}`).allowed)
    throw new Error(
      "An SOS was already requested. Call emergency services if you need immediate help.",
    );
  const existing = checked(
    await db
      .from("sos_incidents")
      .select("*")
      .eq("trip_id", trip.id)
      .eq("triggered_by_id", actor.id)
      .eq("status", "active")
      .abortSignal(timeout())
      .maybeSingle(),
  );
  if (existing)
    return {
      incident: existing,
      broadcast: false,
      notification:
        "An active SOS already exists. Check Reunite or call emergency services.",
    };
  const inserted = await db
    .from("sos_incidents")
    .insert({
      trip_id: trip.id,
      triggered_by_type: actor.role,
      triggered_by_id: actor.id,
      sender_name: actor.name.slice(0, 100),
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      accuracy: point?.accuracy ?? null,
      status: "active",
      delivery_summary: null,
    })
    .select("*")
    .abortSignal(timeout())
    .single();
  if (inserted.error?.code === "23505")
    throw new Error(
      "An SOS is already active. Check Reunite or call emergency services.",
    );
  const incident: Incident = required(inserted);
  const broadcast = await notifyTrip(trip.id, { kind: "sos", incident });
  // Only trip participants are messaged. Emergency services are called by the person.
  let notification =
    "Trip alert only. Call emergency services directly if needed.";
  try {
    let recipients: string[] = [];
    if (actor.role === "companion" && trip.phone_number)
      recipients = [trip.phone_number];
    if (actor.role === "guardian") {
      const contacts = checked(
        await db
          .from("location_links")
          .select("traveller_id,invite_expires_at,share_expires_at,status")
          .eq("trip_id", trip.id)
          .eq("status", "accepted")
          .limit(50)
          .abortSignal(timeout()),
      );
      const ids = (contacts ?? [])
        .filter((link) => isInviteValid(link))
        .map((link) => link.traveller_id);
      if (ids.length) {
        const people = checked(
          await db
            .from("travellers")
            .select("phone_number")
            .eq("trip_id", trip.id)
            .in("id", ids)
            .abortSignal(timeout()),
        );
        recipients = (people ?? [])
          .map((person) => person.phone_number)
          .filter((phone): phone is string => !!phone);
      }
    }
    const validRecipients: string[] = [];
    let hasInvalidRecipient = false;
    for (const rawPhone of recipients) {
      const normalized = normalizeE164(rawPhone);
      if (normalized) {
        if (!validRecipients.includes(normalized)) {
          validRecipients.push(normalized);
        }
      } else {
        hasInvalidRecipient = true;
        console.error(
          `[SOS Alert] Invalid phone number for trip contact (${maskPhone(rawPhone)}). Normalization failed; skipping contact.`,
        );
      }
    }
    const message = `Safr SOS: ${actor.name.slice(0, 100)} requested help. ${point ? `Location: https://www.google.com/maps?q=${point.lat},${point.lng}` : "GPS location unavailable."} Open Safr or your trip sharing page and contact them. This is not an emergency-services dispatch.`;
    const deliveries = await Promise.allSettled(
      validRecipients.map((phone) => sendEmergencyMessage(phone, message)),
    );
    const accepted = deliveries.filter(
      (result) =>
        result.status === "fulfilled" &&
        Object.values(result.value).some(
          (channel) => channel.status === "sent",
        ),
    ).length;
    notification = validRecipients.length
      ? accepted
        ? `Messaging service accepted alerts for ${accepted} of ${validRecipients.length} contacts; delivery is not confirmed.${hasInvalidRecipient ? " Some contacts had invalid phone numbers." : ""}`
        : "Contact messaging was not sent. Use the call buttons for immediate help."
      : hasInvalidRecipient
        ? "Trip contacts have invalid phone numbers. Trip alert only; call emergency services directly."
        : "No active trip contacts have a phone number. Trip alert only; call emergency services directly.";
  } catch {
    notification =
      "Contact messaging could not be confirmed. Use the call buttons for immediate help.";
  }
  incident.delivery_summary = `${broadcast ? "Live trip alert submitted." : "Live trip broadcast unavailable."} ${notification}`;
  // Keep the incident even if storing the transport receipt fails.
  try {
    await db
      .from("sos_incidents")
      .update({ delivery_summary: incident.delivery_summary })
      .eq("id", incident.id)
      .abortSignal(timeout());
  } catch {
    /* Incident is already durable. */
  }

  return { incident, broadcast, notification };
}
export async function runGuardianAction(user: string, data: GuardianAction) {
  checkTrackingAccess(`user:${user}`);
  const trip = await ownedTrip(user, data.tripId);
  switch (data.action) {
    case "invite":
      return generateCompanionInvite(user, trip.id, data.travellerId);
    case "revoke": {
      const old = required(
        await db
          .from("location_links")
          .select("invite_token_hash")
          .eq("id", data.linkId)
          .eq("trip_id", trip.id)
          .eq("owner_id", user)
          .abortSignal(timeout())
          .single(),
      );
      checked(
        await db
          .from("location_links")
          .update({
            status: "revoked",
            sharing_paused: true,
            last_lat: null,
            last_lng: null,
            last_accuracy: null,
            last_battery: null,
            last_seen_at: null,
            last_synced_at: null,
          })
          .eq("id", data.linkId)
          .eq("trip_id", trip.id)
          .eq("owner_id", user)
          .abortSignal(timeout()),
      );
      await broadcastTracking(
        trip.id,
        { kind: "refresh" },
        old.invite_token_hash ? [old.invite_token_hash] : [],
      );
      return { ok: true };
    }
    case "meeting": {
      const now = new Date().toISOString();
      checked(
        await db
          .from("trip_meeting_points")
          .upsert(
            {
              ...data.point,
              trip_id: trip.id,
              created_by: user,
              is_active: true,
              updated_at: now,
            },
            { onConflict: "trip_id" },
          )
          .abortSignal(timeout()),
      );
      await notifyTrip(trip.id, { kind: "refresh" });
      return { ok: true };
    }
    case "clear":
      checked(
        await db
          .from("trip_meeting_points")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("trip_id", trip.id)
          .abortSignal(timeout()),
      );
      await notifyTrip(trip.id, { kind: "refresh" });
      return { ok: true };
    case "resolve":
      checked(
        await db
          .from("sos_incidents")
          .update({
            status: data.status,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", data.incidentId)
          .eq("trip_id", trip.id)
          .abortSignal(timeout()),
      );
      await notifyTrip(trip.id, { kind: "refresh" });
      return { ok: true };
    case "sos":
      return recordSos(
        trip,
        { id: user, role: "guardian", name: trip.traveller_name },
        data.point,
      );
  }
}
export async function runCompanionAction(data: CompanionAction) {
  const link = await tokenLink(data.token);
  checkTrackingAccess(`token:${link.id}`);
  switch (data.action) {
    case "read":
      return loadCompanionState(link);
    case "location":
      return publishLocation(data.token, data.sample, link);
    case "pause":
    case "stop": {
      checked(
        await db
          .from("location_links")
          .update({
            ...(data.action === "stop" ? { status: "revoked" } : {}),
            sharing_paused: true,
            last_lat: null,
            last_lng: null,
            last_accuracy: null,
            last_battery: null,
            last_seen_at: null,
            last_synced_at: null,
          })
          .eq("id", link.id)
          .eq("invite_token_hash", hashInviteToken(data.token))
          .abortSignal(timeout()),
      );
      await broadcastTracking(
        link.trip_id,
        { kind: "paused", linkId: link.id },
        data.action === "stop" && link.invite_token_hash
          ? [link.invite_token_hash]
          : [],
      );
      return { ok: true };
    }
    case "sos": {
      const trip = await tripDetails(link.trip_id);
      const person = required(
        await db
          .from("travellers")
          .select("name")
          .eq("id", link.traveller_id)
          .abortSignal(timeout())
          .single(),
      );
      return recordSos(
        trip,
        { id: link.id, role: "companion", name: person.name },
        data.point,
      );
    }
  }
}
