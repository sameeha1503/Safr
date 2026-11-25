import type { Itinerary } from "@/lib/goa-schemas";
import { cleanWhy } from "@/lib/itinerary-engine";

export function ItinerarySummary({
  itinerary,
  visited,
}: {
  itinerary: Itinerary;
  visited: number;
}) {
  const items = [
    { label: "Stops", value: String(itinerary.stops.length) },
    ...(itinerary.totalMinutes != null
      ? [
          {
            label: "Planned time",
            value: `${Math.floor(itinerary.totalMinutes / 60)}h ${itinerary.totalMinutes % 60}m`,
          },
        ]
      : []),
    ...(itinerary.endTime
      ? [{ label: "Finish by", value: itinerary.endTime }]
      : []),
    ...(itinerary.unusedMinutes != null
      ? [{ label: "Time to spare", value: `${itinerary.unusedMinutes} min` }]
      : []),
  ];

  const aiStatus = itinerary.aiStatus || "not_configured";
  const aiBadgeText =
    aiStatus === "used"
      ? "AI-selected stops"
      : aiStatus === "unavailable"
        ? "AI unavailable, using built-in ranking"
        : "AI not configured";
  const aiBadgeClass =
    aiStatus === "used"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
      : aiStatus === "unavailable"
        ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
        : "bg-secondary text-muted-foreground border-border/60";

  return (
    <div className="mt-5 space-y-4">
      {/* Title & AI Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
        <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
          {itinerary.title}
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${aiBadgeClass}`}
        >
          {aiBadgeText}
        </span>
      </div>
      {/* Journey Header */}
      {itinerary.journey && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
            <span>🚗</span> Journey Route
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {itinerary.journey.start.name || "Starting Point"}
              <span className="mx-2 text-muted-foreground font-normal">→</span>
              {itinerary.journey.destination.name || "Destination"}
            </h3>
            {(itinerary.journey.routeKm != null ||
              itinerary.journey.routeMin != null) && (
              <span className="text-xs font-semibold text-muted-foreground">
                (
                {[
                  itinerary.journey.routeKm != null
                    ? `${itinerary.journey.routeKm} km`
                    : null,
                  itinerary.journey.routeMin != null
                    ? `${itinerary.journey.routeMin} min drive`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                )
              </span>
            )}
          </div>
        </div>
      )}

      {/* Safety & Route Notes */}
      {itinerary.journey &&
        (Boolean(itinerary.journey.safetyNotes?.length) ||
          Boolean(itinerary.journey.hazardZones?.length) ||
          itinerary.journey.returnByText ||
          itinerary.journey.arriveAfterDark) && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <span>🛡️</span> Safety & Route Advisory
            </p>
            {itinerary.journey.returnByText && (
              <p className="text-xs font-semibold text-amber-950 bg-amber-500/20 px-2.5 py-1 rounded-lg w-fit">
                ⏰ {itinerary.journey.returnByText}
              </p>
            )}
            {itinerary.journey.arriveAfterDark && (
              <p className="text-xs font-semibold text-rose-700">
                ⚠️ Portions of this journey are scheduled after dark. Drive with
                extra care on unlit roads.
              </p>
            )}
            {itinerary.journey.hazardZones &&
              itinerary.journey.hazardZones.length > 0 && (
                <p className="text-xs text-amber-950">
                  <span className="font-semibold">Hazard zones on route:</span>{" "}
                  {itinerary.journey.hazardZones.join(", ")}
                </p>
              )}
            {itinerary.journey.safetyNotes &&
              itinerary.journey.safetyNotes.length > 0 && (
                <ul className="text-xs text-amber-950 space-y-1 list-disc list-inside">
                  {itinerary.journey.safetyNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              )}
          </div>
        )}

      {/* Summary Metrics */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border bg-secondary/40 p-3"
          >
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>

      {/* Progress Bar */}
      <div className="print:hidden">
        <label
          htmlFor="itinerary-progress"
          className="text-xs text-muted-foreground"
        >
          {visited} of {itinerary.stops.length} stops visited
        </label>
        <progress
          id="itinerary-progress"
          value={visited}
          max={itinerary.stops.length}
          className="block mt-1 h-2 w-full accent-primary"
        />
      </div>

      {/* Planned Stops & Highlights with Slot Badges & Why */}
      {itinerary.stops && itinerary.stops.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Planned Stops & Highlights
          </h4>
          <div className="space-y-2">
            {itinerary.stops.map((stop, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border/60 bg-secondary/20 p-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">
                      {stop.time}
                    </span>
                    <span className="font-semibold text-foreground">
                      {stop.title}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {stop.slot && (
                      <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase">
                        {stop.slot}
                      </span>
                    )}
                    {stop.openStatus === "unknown" && (
                      <span className="rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold">
                        Hours unconfirmed
                      </span>
                    )}
                    {stop.detourMin != null && stop.detourMin > 0 && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        +{stop.detourMin}m detour
                      </span>
                    )}
                  </div>
                </div>
                {stop.why && (
                  <p className="mt-1.5 text-muted-foreground italic">
                    Why this stop: {cleanWhy(stop.why)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
