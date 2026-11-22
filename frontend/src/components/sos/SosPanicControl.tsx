import { createHoldTrigger } from "@/lib/hold-trigger";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { distanceKm } from "@/lib/geo";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { guardianTrackingAction } from "@/lib/location-sharing.functions";
import {
  EMERGENCY_CONTACTS,
  EMERGENCY_NUMBERS,
} from "@/lib/emergency-contacts";
export type SosPoint = {
  lat: number;
  lng: number;
  accuracy: number | null;
} | null;
export type SosSend = (point: SosPoint) => Promise<string>;
export function SosPanicControl({
  send,
  localOnly = false,
}: {
  send?: SosSend;
  localOnly?: boolean;
}) {
  const guardian = useServerFn(guardianTrackingAction);
  const [open, setOpen] = useState(false),
    [holding, setHolding] = useState(false),
    [message, setMessage] = useState(""),
    [point, setPoint] = useState<SosPoint>(null);
  const [landmark, setLandmark] = useState<string | null>(null);
  const hold = useRef<ReturnType<typeof createHoldTrigger> | null>(null),
    activateRef = useRef<() => void>(() => {});
  if (!hold.current)
    hold.current = createHoldTrigger(() => activateRef.current());
  const active = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      hold.current?.cancel();
    };
  }, []);
  const cancel = () => {
    hold.current?.cancel();
    setHolding(false);
  };
  const activate = async () => {
    if (active.current) return;
    active.current = true;
    setHolding(false);
    setOpen(true);
    setPoint(null);
    setLandmark(null);
    setMessage("Finding your location. You can call for help immediately.");
    try {
      navigator.vibrate?.([100, 50, 100]);
    } catch {
      /* Haptics are optional. */
    }
    const location = await new Promise<SosPoint>((resolve) => {
      const timer = setTimeout(() => resolve(null), 6000);
      const finish = (value: SosPoint) => {
        clearTimeout(timer);
        resolve(value);
      };
      if (!navigator.geolocation) {
        finish(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) =>
          finish({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
          }),
        () => finish(null),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 },
      );
    });
    if (mounted.current) setPoint(location);
    if (location)
      void import("@/lib/goa-places-data")
        .then(({ CURATED_GOA_PLACES }) => {
          const nearest = CURATED_GOA_PLACES.map((place) => ({
            name: place.name,
            km: distanceKm(location, place),
          })).sort((a, b) => a.km - b.km)[0];
          if (mounted.current && nearest && nearest.km < 20)
            setLandmark(
              `${nearest.name} · ${nearest.km.toFixed(1)} km away in a straight line (nearest listed landmark)`,
            );
        })
        .catch(() => {});
    try {
      const result = localOnly
        ? "Call emergency services directly. No trip alert was sent."
        : send
          ? await send(location)
          : await guardian({ data: { action: "sos", point: location } }).then(
              (result) =>
                "incident" in result
                  ? `${result.broadcast ? "Trip alert submitted." : "Live trip broadcast unavailable."} ${result.notification}`
                  : "SOS could not be recorded.",
            );
      if (mounted.current) setMessage(result);
    } catch {
      if (mounted.current)
        setMessage(
          "Trip alert could not be confirmed. Call emergency services directly. You can also check Reunite before retrying.",
        );
    } finally {
      active.current = false;
    }
  };
  activateRef.current = () => void activate();
  const begin = () => {
    if (active.current) return;
    setHolding(true);
    hold.current?.start();
  };
  const end = () => {
    hold.current?.cancel();
    setHolding(false);
  };
  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className="relative overflow-hidden rounded-2xl shrink-0 px-2.5 sm:px-4"
        aria-label="Hold for two seconds to activate SOS"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          begin();
        }}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            end();
        }}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onBlur={end}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            if (!event.repeat) begin();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            end();
          }
        }}
      >
        {holding && (
          <span
            aria-hidden="true"
            className="absolute inset-0 origin-left bg-white/25"
            style={{ animation: "sos-hold 2s linear forwards" }}
          />
        )}
        {holding ? (
          <svg
            aria-hidden="true"
            className="size-5 -rotate-90"
            viewBox="0 0 36 36"
          >
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              pathLength="100"
              strokeDasharray="100"
              style={{ animation: "sos-ring 2s linear forwards" }}
            />
          </svg>
        ) : (
          <AlertTriangle className="size-4" />
        )}
        <span className="hidden sm:inline">
          {holding ? "Keep holding…" : "SOS"}
        </span>
      </Button>
      <style>{`@keyframes sos-ring {from {stroke-dashoffset:100} to {stroke-dashoffset:0}} @keyframes sos-hold {from {transform:scaleX(0)} to {transform:scaleX(1)}}`}</style>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          cancel();
          setOpen(value);
        }}
      >
        <DialogContent className="border-destructive/50 max-h-[90dvh] overflow-y-auto">
          <DialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle /> Emergency help
          </DialogTitle>
          <DialogDescription>
            Call for urgent help. Safr does not dispatch emergency services or
            guarantee message delivery.
          </DialogDescription>
          {landmark && (
            <p className="text-sm text-muted-foreground">{landmark}</p>
          )}
          <p role="status" className="text-sm">
            {message}
          </p>
          <p className="text-sm font-mono">
            {point
              ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} · GPS ±${Math.round(point.accuracy ?? 0)} m`
              : "GPS location unavailable"}
          </p>
          <a
            className="rounded-xl bg-destructive p-4 text-center text-destructive-foreground font-bold"
            href={`tel:${EMERGENCY_NUMBERS.police}`}
          >
            Call emergency services · {EMERGENCY_NUMBERS.police}
          </a>
          {EMERGENCY_CONTACTS.filter((contact) =>
            ["ambulance", "pink", "women", "child", "drishti"].includes(
              contact.id,
            ),
          ).map((contact) => (
            <a
              key={contact.id}
              className="rounded-xl border p-3 text-sm"
              href={`tel:${contact.phone}`}
            >
              {contact.name} · {contact.phone}
              {!contact.verified ? " (directory number; not verified)" : ""}
            </a>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
