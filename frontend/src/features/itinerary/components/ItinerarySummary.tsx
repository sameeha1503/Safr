import type { Itinerary } from "@/lib/goa-schemas";

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
  return (
    <div className="mt-5 space-y-3">
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
    </div>
  );
}
