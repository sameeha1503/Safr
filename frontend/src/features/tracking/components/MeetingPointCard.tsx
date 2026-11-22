import { Star, Navigation } from "lucide-react";
import type { Coordinate } from "@/lib/geo";
import {
  distanceBearing,
  walkingDirections,
  type MeetingPoint,
} from "@/lib/companion-tracking";
export function MeetingPointCard({
  meeting,
  origin,
}: {
  meeting: MeetingPoint;
  origin?: Coordinate | null;
}) {
  const distance = origin ? distanceBearing(origin, meeting) : null;
  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
        <Star className="size-4" /> Family meeting spot
      </p>
      <h2 className="text-lg font-semibold">{meeting.title}</h2>
      {meeting.notes && <p className="text-sm">{meeting.notes}</p>}
      {distance && (
        <p className="text-sm text-muted-foreground">
          {distance.metres} m {distance.cardinal} · straight-line distance
        </p>
      )}
      <a
        href={walkingDirections(meeting)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold underline"
      >
        <Navigation className="size-4" /> Walking directions
      </a>
    </section>
  );
}
