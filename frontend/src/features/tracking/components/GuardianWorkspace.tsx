import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  MapPin,
  Users,
  LocateFixed,
  Share2,
  Star,
  Battery,
  Navigation,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { guardianTrackingAction } from "@/lib/location-sharing.functions";
import { searchPlaces } from "@/lib/maps.functions";
import { trackingFailureKind } from "@/lib/tracking-errors";
import type { GuardianAction } from "@/lib/tracking-actions";
import {
  distanceBearing,
  locationAge,
  walkingDirections,
} from "@/lib/companion-tracking";
import type { Coordinate } from "@/lib/geo";
import {
  trackingKey,
  useGuardianWorkspace,
} from "../hooks/useGuardianWorkspace";
import { useDevicePosition } from "../hooks/useDevicePosition";
import { TrackingMap, type TrackingPin } from "./TrackingMap";
import { MeetingPointCard } from "./MeetingPointCard";
export function GuardianWorkspace() {
  const query = useGuardianWorkspace(),
    client = useQueryClient(),
    action = useServerFn(guardianTrackingAction),
    search = useServerFn(searchPlaces),
    gps = useDevicePosition();
  const [invite, setInvite] = useState<{
      url: string;
      name: string;
      expires: string;
    } | null>(null),
    [qr, setQr] = useState(""),
    [traveller, setTraveller] = useState("");
  const [pick, setPick] = useState(false),
    [point, setPoint] = useState<Coordinate | null>(null),
    [title, setTitle] = useState("Family Meeting Spot"),
    [notes, setNotes] = useState(""),
    [searchText, setSearchText] = useState("");
  const [selected, setSelected] = useState<string | null>(null),
    [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let alive = true;
    setQr("");
    if (invite)
      void import("qrcode")
        .then((module) =>
          module.toDataURL(invite.url, { width: 240, margin: 2 }),
        )
        .then((url) => {
          if (alive) setQr(url);
        })
        .catch(() =>
          toast.error("QR unavailable. You can still copy the invite link."),
        );
    return () => {
      alive = false;
    };
  }, [invite]);
  const mutation = useMutation({
    mutationFn: (data: GuardianAction) => action({ data }),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: trackingKey });
      if ("path" in result)
        setInvite({
          url: new URL(result.path, window.location.origin).href,
          name: result.name,
          expires: result.expiresAt,
        });
    },
    onError: (error) => toast.error(error.message),
  });
  const searchMutation = useMutation({
    mutationFn: () => search({ data: { query: searchText } }),
    onError: () =>
      toast.error(
        "Address search unavailable. Choose a spot on the map instead.",
      ),
  });
  const data = query.data;
  const pins = useMemo(() => {
    const list: TrackingPin[] = (data?.members ?? []).flatMap((member) =>
      member.sample && !member.paused && member.status === "accepted"
        ? [
            {
              id: member.id,
              label: member.name,
              kind: "member",
              lat: member.sample.lat,
              lng: member.sample.lng,
              stale: now - Date.parse(member.sample.capturedAt) > 60000,
            },
          ]
        : [],
    );
    if (data?.meeting)
      list.push({
        id: "meeting",
        label: data.meeting.title,
        kind: "meeting",
        lat: data.meeting.lat,
        lng: data.meeting.lng,
      });
    if (point)
      list.push({
        ...point,
        id: "draft",
        label: "Proposed meeting spot",
        kind: "meeting",
      });
    if (gps.sample)
      list.push({ ...gps.sample, id: "me", label: "You", kind: "me" });
    return list;
  }, [data, point, gps.sample, now]);
  const selectPin = (id: string) => {
    setSelected(id);
    document
      .getElementById(`companion-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  return (
    <AppShell
      title="Reunite"
      subtitle="Stay together, with permission"
      back
      wide
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Your people, one meeting spot</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite companions to share while their browser is open. Links expire
            after 24 hours.
          </p>
        </div>
        <Link to="/setup" className="text-sm font-semibold underline">
          Manage companions
        </Link>
      </div>
      {data && !query.isError && (
        <p role="status" className="mb-4 text-xs text-muted-foreground">
          {query.connection === "live"
            ? "Live trip connection active"
            : "Live connection unavailable or connecting. Saved positions refresh every 30 seconds."}
        </p>
      )}
      {query.isPending ? (
        <p role="status">Loading your trip…</p>
      ) : query.isError ? (
        <div role="alert" className="rounded-2xl border p-5 space-y-3">
          <p>{query.error.message}</p>
          <Button
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? "Checking…" : "Check again"}
          </Button>
          {trackingFailureKind(query.error) === "trip" && (
            <Link to="/setup" className="ml-4 underline">
              Set up a trip
            </Link>
          )}
          {trackingFailureKind(query.error) === "session" && (
            <Link to="/auth" className="ml-4 underline">
              Sign in again
            </Link>
          )}
        </div>
      ) : (
        data && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
              <Users className="size-5" />
              <span className="font-semibold">{data.trip.name}</span>
              <select
                aria-label="Companion to invite"
                value={traveller}
                onChange={(event) => setTraveller(event.target.value)}
                className="max-w-full rounded-xl border bg-background p-2 text-sm"
              >
                <option value="">Choose companion</option>
                {data.travellers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <Button
                disabled={!traveller || mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    action: "invite",
                    tripId: data.trip.id,
                    travellerId: traveller,
                  })
                }
              >
                <Share2 className="size-4" /> Create invite
              </Button>
              <p className="text-xs text-muted-foreground">
                A new invite replaces this companion’s previous link.
              </p>
            </div>
            {data.incidents.map((incident) => (
              <section
                key={incident.id}
                role="alert"
                className="mb-4 rounded-2xl border-2 border-destructive bg-destructive/10 p-4 space-y-3"
              >
                <h3 className="font-bold text-destructive">
                  SOS · {incident.sender_name}
                </h3>
                <p className="text-sm">
                  Requested help at{" "}
                  {new Date(incident.created_at).toLocaleTimeString()}. Contact
                  them and call emergency services when needed.
                </p>
                <p className="text-xs text-muted-foreground">
                  {incident.delivery_summary ??
                    "Messaging status is not yet available."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {incident.lat !== null && incident.lng !== null && (
                    <Button asChild variant="outline">
                      <a
                        href={walkingDirections({
                          lat: incident.lat,
                          lng: incident.lng,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Directions to SOS location
                      </a>
                    </Button>
                  )}
                  <Button
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        action: "resolve",
                        tripId: data.trip.id,
                        incidentId: incident.id,
                        status: "resolved",
                      })
                    }
                  >
                    Mark resolved
                  </Button>
                  <Button
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        action: "resolve",
                        tripId: data.trip.id,
                        incidentId: incident.id,
                        status: "false_alarm",
                      })
                    }
                  >
                    Mark false alarm
                  </Button>
                </div>
              </section>
            ))}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={gps.running ? gps.stop : gps.start}
                  >
                    <LocateFixed className="size-4" />
                    {gps.running ? "Stop my GPS" : "Use my location"}
                  </Button>
                  <Button
                    variant={pick ? "default" : "outline"}
                    onClick={() => setPick((value) => !value)}
                  >
                    <Star className="size-4" />
                    {pick ? "Cancel map selection" : "Set meeting spot"}
                  </Button>
                </div>
                {gps.error && (
                  <p role="status" className="text-sm text-destructive">
                    {gps.error}
                  </p>
                )}
                <TrackingMap
                  pins={pins}
                  selecting={pick}
                  onPick={(value) => {
                    setPoint(value);
                    setPick(false);
                  }}
                  onSelect={selectPin}
                />
                <p className="text-xs text-muted-foreground">
                  Grey pins are older than one minute. Distances are
                  straight-line estimates; walking directions open in your maps
                  app. Background or locked browsers may stop GPS updates.
                </p>
                {data.meeting && (
                  <>
                    <MeetingPointCard
                      meeting={data.meeting}
                      origin={gps.sample}
                    />
                    <Button
                      variant="ghost"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          action: "clear",
                          tripId: data.trip.id,
                        })
                      }
                    >
                      Clear meeting spot
                    </Button>
                  </>
                )}
                <form
                  className="rounded-2xl border bg-card p-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (searchText.trim()) searchMutation.mutate();
                  }}
                >
                  <Label htmlFor="meeting-search">Find a meeting address</Label>
                  <div className="flex gap-2">
                    <Input
                      id="meeting-search"
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      placeholder="Search a landmark or address"
                    />
                    <Button
                      disabled={searchMutation.isPending || !searchText.trim()}
                      type="submit"
                    >
                      Search
                    </Button>
                  </div>
                  {searchMutation.data?.slice(0, 6).map((hit) => (
                    <button
                      type="button"
                      key={hit.id}
                      className="block w-full rounded-lg p-2 text-left text-sm hover:bg-secondary"
                      onClick={() => {
                        setPoint({ lat: hit.lat, lng: hit.lng });
                        setTitle(hit.name.slice(0, 100));
                      }}
                    >
                      <MapPin className="mr-2 inline size-3" />
                      {hit.name}
                    </button>
                  ))}
                </form>
                {point && (
                  <form
                    className="rounded-2xl border border-amber-500/40 bg-card p-4 space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      mutation.mutate(
                        {
                          action: "meeting",
                          tripId: data.trip.id,
                          point: {
                            ...point,
                            title,
                            notes: notes.trim() || null,
                          },
                        },
                        { onSuccess: () => setPoint(null) },
                      );
                    }}
                  >
                    <Label htmlFor="meeting-title">Meeting spot name</Label>
                    <Input
                      id="meeting-title"
                      value={title}
                      maxLength={100}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                    />
                    <Label htmlFor="meeting-notes">
                      How to find it (optional)
                    </Label>
                    <Input
                      id="meeting-notes"
                      value={notes}
                      maxLength={500}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="For example, beside the main entrance"
                    />
                    <p className="text-xs text-muted-foreground">
                      {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                    </p>
                    <Button
                      disabled={mutation.isPending || !title.trim()}
                      type="submit"
                    >
                      Share meeting spot
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPoint(null)}
                    >
                      Cancel
                    </Button>
                  </form>
                )}
              </div>
              <aside className="space-y-3">
                <h3 className="font-bold">Companions</h3>
                {!data.members.length && (
                  <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                    Create an invite above. Each person chooses whether to share
                    their location.
                  </p>
                )}
                {data.members.map((member) => {
                  const distance =
                    gps.sample && member.sample
                      ? distanceBearing(gps.sample, member.sample)
                      : null;
                  return (
                    <section
                      id={`companion-${member.id}`}
                      key={member.id}
                      className={`rounded-2xl border bg-card p-4 space-y-2 ${selected === member.id ? "ring-2 ring-primary" : ""}`}
                    >
                      <h4 className="font-semibold">{member.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {member.status !== "accepted"
                          ? member.status
                          : member.paused
                            ? "Sharing paused"
                            : locationAge(member.sample, now)}
                      </p>
                      {member.sample &&
                        !member.paused &&
                        member.status === "accepted" && (
                          <>
                            <p className="text-xs">
                              GPS ±{Math.round(member.sample.accuracy)} m
                              {member.sample.battery !== null && (
                                <span className="ml-3">
                                  <Battery className="mr-1 inline size-3" />
                                  {Math.round(member.sample.battery)}%
                                </span>
                              )}
                            </p>
                            {distance && (
                              <p className="text-sm">
                                {distance.metres} m {distance.cardinal} from you
                                · straight line
                              </p>
                            )}
                            <a
                              className="inline-flex items-center gap-1 text-sm font-semibold underline"
                              target="_blank"
                              rel="noopener noreferrer"
                              href={walkingDirections(member.sample)}
                            >
                              <Navigation className="size-3" /> Walking
                              directions
                            </a>
                          </>
                        )}
                      {["pending", "accepted"].includes(member.status) && (
                        <Button
                          className="block"
                          variant="ghost"
                          size="sm"
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              action: "revoke",
                              tripId: data.trip.id,
                              linkId: member.id,
                            })
                          }
                        >
                          Revoke sharing link
                        </Button>
                      )}
                    </section>
                  );
                })}
              </aside>
            </div>
          </>
        )
      )}
      <Dialog
        open={!!invite}
        onOpenChange={(open) => {
          if (!open) setInvite(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Invite {invite?.name}</DialogTitle>
          <DialogDescription>
            Anyone with this link can act as this companion. Share it directly
            with them. It expires in 24 hours.
          </DialogDescription>
          {qr && (
            <img
              src={qr}
              alt="Scan this QR code to open your sharing invitation"
              className="mx-auto size-60"
            />
          )}
          <Input
            aria-label="Companion invitation link"
            readOnly
            value={invite?.url ?? ""}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (!navigator.clipboard) {
                  toast.error("Select and copy the invite link above.");
                  return;
                }
                if (invite)
                  void navigator.clipboard
                    ?.writeText(invite.url)
                    .then(() => toast.success("Invite copied"))
                    .catch(() =>
                      toast.error(
                        "Could not copy. Select and copy the link above.",
                      ),
                    );
              }}
            >
              Copy link
            </Button>
            {invite && (
              <Button variant="outline" asChild>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(`Join my Safr trip as ${invite.name}: ${invite.url}`)}`}
                >
                  Share on WhatsApp
                </a>
              </Button>
            )}
          </div>
          {invite && (
            <p className="text-xs text-muted-foreground">
              Expires {new Date(invite.expires).toLocaleString()}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
