import { z } from "zod";
import { distanceKm, type Coordinate } from "./geo";
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const pointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
export const sampleSchema = pointSchema.extend({
  accuracy: z.number().finite().min(0).max(100000),
  battery: z.number().finite().min(0).max(100).nullable(),
  capturedAt: z.string().datetime({ offset: true }),
});
export type LocationSample = z.infer<typeof sampleSchema>;
export const meetingSchema = pointSchema.extend({
  title: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(500).nullable(),
});
export type MeetingPoint = z.infer<typeof meetingSchema> & {
  id: string;
  trip_id: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type Incident = {
  id: string;
  trip_id: string;
  triggered_by_type: "guardian" | "companion";
  triggered_by_id: string;
  sender_name: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  status: "active" | "resolved" | "false_alarm";
  created_at: string;
  resolved_at: string | null;
  delivery_summary: string | null;
};
export type TrackingLink = {
  id: string;
  owner_id: string;
  trip_id: string;
  traveller_id: string;
  phone_number: string | null;
  status: string;
  invite_token_hash: string | null;
  invite_expires_at: string | null;
  share_expires_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_accuracy: number | null;
  last_battery: number | null;
  last_seen_at: string | null;
  last_synced_at: string | null;
  sharing_paused: boolean;
  created_at: string;
};
export type Member = {
  revision: string;
  id: string;
  name: string;
  status: string;
  paused: boolean;
  sample: LocationSample | null;
};
export type GuardianState = {
  trip: { id: string; name: string };
  travellers: { id: string; name: string }[];
  members: Member[];
  meeting: MeetingPoint | null;
  incidents: Incident[];
};
export type CompanionState = {
  tripTitle: string;
  guardianName: string;
  companionName: string;
  linkId: string;
  room: string;
  meeting: MeetingPoint | null;
  incidents: Pick<Incident, "id" | "sender_name" | "created_at" | "status">[];
};
export const sosSchema = z.object({
  point: pointSchema
    .extend({ accuracy: z.number().finite().min(0).max(100000).nullable() })
    .nullable(),
});
export function isInviteValid(
  link: Pick<TrackingLink, "status" | "invite_expires_at" | "share_expires_at">,
  now = Date.now(),
) {
  const expiry = Math.min(
    Date.parse(link.invite_expires_at ?? ""),
    Date.parse(link.share_expires_at ?? ""),
  );
  return (
    ["pending", "accepted"].includes(link.status) &&
    Number.isFinite(expiry) &&
    expiry > now
  );
}
export function distanceBearing(from: Coordinate, to: Coordinate) {
  const r = Math.PI / 180,
    d = (to.lng - from.lng) * r;
  const degrees =
    (Math.atan2(
      Math.sin(d) * Math.cos(to.lat * r),
      Math.cos(from.lat * r) * Math.sin(to.lat * r) -
        Math.sin(from.lat * r) * Math.cos(to.lat * r) * Math.cos(d),
    ) /
      r +
      360) %
    360;
  return {
    metres: Math.round(distanceKm(from, to) * 1000),
    degrees,
    cardinal: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
      Math.round(degrees / 45) % 8
    ]!,
  };
}
export function locationAge(sample: LocationSample | null, now = Date.now()) {
  if (!sample) return "No location shared";
  const age = Math.max(
    0,
    Math.floor((now - Date.parse(sample.capturedAt)) / 1000),
  );
  return age < 15
    ? "Updated just now"
    : age < 60
      ? `Updated ${age}s ago`
      : `Last seen ${Math.floor(age / 60)} min ago`;
}
export function isFreshSample(sample: LocationSample, now = Date.now()) {
  const age = now - Date.parse(sample.capturedAt);
  return age >= -10000 && age <= 60000;
}
export function shouldPersistLocation(
  lastSeen: string | null,
  now = Date.now(),
) {
  return !lastSeen || now - Date.parse(lastSeen) >= 30000;
}
export function walkingDirections(point: Coordinate) {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=walking`;
}

/** A delayed database snapshot must not replace newer private-channel GPS. */
export function mergeTrackingSnapshot(
  current: GuardianState | undefined,
  fresh: GuardianState,
): GuardianState {
  if (current?.trip.id !== fresh.trip.id) return fresh;
  return {
    ...fresh,
    members: fresh.members.map((member) => {
      const old = current.members.find((item) => item.id === member.id);
      return member.status === "accepted" &&
        !member.paused &&
        old?.sample &&
        !old.paused &&
        old.revision === member.revision &&
        (!member.sample ||
          Date.parse(old.sample.capturedAt) >
            Date.parse(member.sample.capturedAt))
        ? { ...member, sample: old.sample }
        : member;
    }),
  };
}
export function applyLiveMember(
  state: GuardianState,
  member: Member,
): GuardianState {
  const previous = state.members.find((item) => item.id === member.id);
  if (
    !previous ||
    previous.revision !== member.revision ||
    !["pending", "accepted"].includes(previous.status) ||
    !member.sample
  )
    return state;
  if (
    previous.sample &&
    Date.parse(previous.sample.capturedAt) >
      Date.parse(member.sample.capturedAt)
  )
    return state;
  return {
    ...state,
    members: state.members.map((item) =>
      item.id === member.id ? member : item,
    ),
  };
}
