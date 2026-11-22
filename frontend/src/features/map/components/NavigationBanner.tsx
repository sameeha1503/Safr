import { Flag, Navigation, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { NavigationProgress } from "../lib/navigation-progress";

function distanceLabel(meters: number | null) {
  if (meters == null) return "Continue";
  return meters < 1000
    ? `${Math.max(10, Math.round(meters / 10) * 10)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

export function NavigationBanner({
  active,
  progress,
  destination,
  gpsReady,
  accuracy,
  lastUpdated,
  rerouting,
  onStart,
  onStop,
}: {
  active: boolean;
  progress: NavigationProgress | null;
  destination: string | null;
  gpsReady: boolean;
  accuracy: number | null;
  lastUpdated: number | null;
  rerouting: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [active]);
  const weakGps =
    accuracy === null ||
    accuracy > 50 ||
    lastUpdated === null ||
    now - lastUpdated > 15_000;
  if (!destination) return null;
  if (!active)
    return (
      <Button
        className="absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full shadow-xl"
        onClick={onStart}
      >
        <Navigation className="size-4" />
        {gpsReady ? "Start in-app navigation" : "Enable GPS navigation"}
      </Button>
    );

  return (
    <section
      aria-label="Active navigation"
      aria-live="polite"
      className="absolute left-3 right-3 top-16 z-20 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-xl backdrop-blur-xl sm:left-1/2 sm:right-auto sm:w-[min(440px,calc(100%-24px))] sm:-translate-x-1/2"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-primary p-2 text-primary-foreground">
          {progress?.arrived ? (
            <Flag className="size-5" />
          ) : (
            <Navigation className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            {weakGps
              ? "Waiting for a reliable GPS fix"
              : rerouting
                ? "Rerouting…"
                : progress?.arrived
                  ? "You have arrived"
                  : progress?.offRoute
                    ? `Off route by about ${progress.offRouteMeters} m`
                    : distanceLabel(progress?.distanceToStepMeters ?? null)}
          </p>
          {weakGps && (
            <p className="text-xs">
              Position is approximate or out of date. Automatic rerouting waits
              for fresh GPS.
            </p>
          )}
          <p className="truncate text-sm font-bold">
            {progress?.arrived
              ? destination
              : (progress?.nextStep?.instruction ??
                (progress
                  ? `Continue toward ${destination}`
                  : "Finding your position on the route…"))}
          </p>
          {progress && !progress.arrived && (
            <p className="mt-1 text-xs text-muted-foreground">
              {distanceLabel(progress.remainingMeters)} remaining · about{" "}
              {Math.max(1, Math.ceil(progress.remainingSeconds / 60))} min
              {" · estimated arrival "}
              {new Date(
                now + progress.remainingSeconds * 1000,
              ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Stop navigation"
          onClick={onStop}
        >
          {rerouting ? (
            <RotateCcw className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
        </Button>
      </div>
    </section>
  );
}
