import { useSosSignals } from "../hooks/useSosSignals";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Radio, Pause, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SosPanicControl } from "@/components/sos/SosPanicControl";
import { supabase } from "@/integrations/supabase/client";
import { companionTrackingAction } from "@/lib/location-sharing.functions";
import {
  isFreshSample,
  tokenSchema,
  type LocationSample,
} from "@/lib/companion-tracking";
import { useDevicePosition } from "../hooks/useDevicePosition";
import { MeetingPointCard } from "./MeetingPointCard";
import { TrackingMap, type TrackingPin } from "./TrackingMap";
export function CompanionPage({ token }: { token: string }) {
  const action = useServerFn(companionTrackingAction),
    client = useQueryClient(),
    gps = useDevicePosition();
  const [status, setStatus] = useState(
      "Location is private until you start sharing.",
    ),
    [stopping, setStopping] = useState(false),
    [lastSent, setLastSent] = useState(0),
    [now, setNow] = useState(Date.now);
  const pending = useRef<Promise<unknown> | null>(null),
    latest = useRef<LocationSample | null>(null),
    enabled = useRef(false),
    mounted = useRef(true);
  const lastAttempt = useRef(0),
    sendLatest = useRef<() => void>(() => {});
  latest.current = gps.sample;
  enabled.current = gps.running;
  const key = ["companion", token];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const result = await action({ data: { action: "read", token } });
      if (!("tripTitle" in result)) throw new Error("Invitation unavailable.");
      return result;
    },
    enabled: tokenSchema.safeParse(token).success,
    retry: false,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  const stopGps = gps.stop;
  const stop = useCallback(
    async (permanent = false) => {
      enabled.current = false;
      stopGps();
      setStopping(true);
      setLastSent(0);
      // Finish an in-flight location write before clearing the stored location.
      await pending.current?.catch(() => {});
      try {
        await action({ data: { action: permanent ? "stop" : "pause", token } });
        if (mounted.current)
          setStatus(
            permanent
              ? "Sharing ended. This link can no longer be used."
              : "Sharing paused. Your last location has been cleared.",
          );
      } catch {
        if (mounted.current)
          setStatus(
            "GPS stopped on this device. Could not confirm server pause; the guardian may still see your last location until it becomes stale.",
          );
      } finally {
        if (mounted.current) setStopping(false);
      }
    },
    [action, stopGps, token],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      enabled.current = false;
    };
  }, []);
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => {
    if (query.isError && gps.running) void stop();
  }, [query.isError, gps.running, stop]);
  useEffect(() => {
    const room = query.data?.room;
    if (!room) return;
    let lastRefresh = 0;
    const channel = supabase
      .channel(room)
      .on("broadcast", { event: "refresh" }, () => {
        // Public notifications carry no location or identity data and are only refetch hints.
        if (Date.now() - lastRefresh < 2000) return;
        lastRefresh = Date.now();
        void client.invalidateQueries({ queryKey: ["companion", token] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [query.data?.room, client, token]);
  useEffect(() => {
    if (!gps.running) return;
    const transmit = () => {
      const sample = latest.current;
      if (
        !enabled.current ||
        pending.current ||
        !sample ||
        Date.now() - lastAttempt.current < 2000
      )
        return;
      if (!isFreshSample(sample)) {
        setStatus(
          "Waiting for a fresh GPS fix. Your previous location is no longer live.",
        );
        return;
      }
      lastAttempt.current = Date.now();
      const task = action({ data: { action: "location", token, sample } })
        .then((result) => {
          if (!mounted.current || !enabled.current) return;
          if ("realtime" in result) {
            if (result.realtime || result.persisted) setLastSent(Date.now());
            setStatus(
              result.realtime
                ? "Sharing live. Keep this page open."
                : result.persisted
                  ? "Location saved. Live connection unavailable; updates may be delayed."
                  : "Live update failed. Retrying while this page is open.",
            );
          }
        })
        .catch(() => {
          if (mounted.current && enabled.current)
            setStatus(
              "Update not confirmed. Check your connection; Safr will retry.",
            );
        })
        .finally(() => {
          if (pending.current === task) pending.current = null;
        });
      pending.current = task;
    };
    sendLatest.current = transmit;
    transmit();
    const timer = setInterval(transmit, 1000);
    return () => {
      clearInterval(timer);
      sendLatest.current = () => {};
    };
  }, [gps.running, action, token]);
  useEffect(() => {
    sendLatest.current();
  }, [gps.sample]);
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && enabled.current)
        setStatus(
          "Background GPS may pause. Return to this page to continue live sharing.",
        );
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);
  const data = query.data;
  useSosSignals(data?.incidents ?? []);
  const pins: TrackingPin[] = [];
  if (gps.sample)
    pins.push({ ...gps.sample, id: "me", label: "You", kind: "me" });
  if (data?.meeting)
    pins.push({
      ...data.meeting,
      id: "meeting",
      label: data.meeting.title,
      kind: "meeting",
    });
  const active =
    gps.running &&
    lastSent > 0 &&
    now - lastSent < 15000 &&
    gps.sample &&
    isFreshSample(gps.sample, now);
  const displayStatus =
    gps.running && lastSent > 0 && now - lastSent >= 15000
      ? "No recent update confirmation. Your connection may be interrupted."
      : status;
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-6 pb-12 text-foreground">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold text-xl">
          <ShieldCheck className="text-primary" /> Safr companion
        </div>
        <SosPanicControl
          send={async (point) => {
            const result = await action({
              data: { action: "sos", token, point },
            });
            if (!("incident" in result)) throw new Error("SOS unavailable");
            void client.invalidateQueries({ queryKey: ["companion", token] });
            return `${result.broadcast ? "Trip alert submitted." : "Live trip broadcast unavailable."} ${result.notification}`;
          }}
        />
      </header>
      <p className="text-xs text-muted-foreground">
        Hold SOS for two seconds for emergency help.
      </p>
      {!tokenSchema.safeParse(token).success ? (
        <p role="alert">
          This invite is invalid. Ask your guardian for a new link.
        </p>
      ) : query.isPending ? (
        <p role="status">Checking your invitation…</p>
      ) : query.isError ? (
        <section role="alert" className="rounded-2xl border p-5 space-y-3">
          <h1 className="font-bold">Sharing unavailable</h1>
          <p>{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Retry invitation</Button>
        </section>
      ) : (
        data && (
          <>
            <section className="rounded-3xl border bg-card p-6 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                {data.tripTitle}
              </p>
              <h1 className="text-2xl font-bold">Hi, {data.companionName}</h1>
              <p className="text-sm text-muted-foreground">
                {data.guardianName} invited you to share your location for this
                trip. They can see your position, GPS accuracy and battery level
                when available.
              </p>
              <p className="text-sm text-muted-foreground">
                Sharing works while this page is open. Your browser may stop
                updates when the screen is locked. You can pause at any time.
              </p>
              <Button
                className="w-full"
                disabled={stopping}
                onClick={() => {
                  if (gps.running) void stop();
                  else {
                    setStatus("Waiting for location permission and a GPS fix…");
                    setLastSent(0);
                    gps.start();
                  }
                }}
              >
                {gps.running ? (
                  <>
                    <Pause className="size-4" /> Pause sharing
                  </>
                ) : (
                  <>
                    <Radio className="size-4" /> Start sharing location
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                disabled={stopping}
                onClick={() => void stop(true)}
              >
                End sharing and deactivate this link
              </Button>
              <p role="status" aria-live="polite" className="text-sm">
                <span
                  className={`mr-2 inline-block size-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
                />
                {displayStatus}
              </p>
              {gps.error && (
                <p role="alert" className="text-sm text-destructive">
                  {gps.error}
                </p>
              )}
              {gps.sample && (
                <p className="text-xs text-muted-foreground">
                  <MapPin className="mr-1 inline size-3" />
                  GPS ±{Math.round(gps.sample.accuracy)} m
                  {gps.sample.battery !== null
                    ? ` · Battery ${gps.sample.battery}%`
                    : ""}
                </p>
              )}
            </section>
            {data.incidents.map((incident) => (
              <div
                key={incident.id}
                role="alert"
                className="rounded-2xl border-2 border-destructive bg-destructive/10 p-4"
              >
                <p className="font-bold text-destructive">
                  SOS: {incident.sender_name} requested help
                </p>
                <p className="mt-1 text-sm">
                  Contact your guardian. Call emergency services directly if
                  needed.
                </p>
              </div>
            ))}
            {data.meeting ? (
              <>
                <MeetingPointCard meeting={data.meeting} origin={gps.sample} />
                <TrackingMap pins={pins} />
              </>
            ) : (
              <section className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                Your guardian hasn’t set a meeting spot yet. It will appear here
                when shared.
              </section>
            )}
          </>
        )
      )}
    </main>
  );
}
