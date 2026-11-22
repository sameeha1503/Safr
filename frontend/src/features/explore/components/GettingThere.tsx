import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getTravelTimes } from "@/lib/goa.functions";
import type { Coordinate } from "@/lib/geo";

export function GettingThere({
  place,
  origin,
}: {
  place: Coordinate & { name: string };
  origin: Coordinate | null;
}) {
  const get = useServerFn(getTravelTimes);
  const query = useQuery({
    queryKey: [
      "explore-getting-there",
      origin?.lat,
      origin?.lng,
      place.lat,
      place.lng,
    ],
    enabled: Boolean(origin),
    queryFn: () =>
      get({
        data: {
          origin: origin!,
          destinations: [{ lat: place.lat, lng: place.lng }],
        },
      }),
    staleTime: 300000,
    retry: false,
  });
  const time = query.data?.[0];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-medium">
        Getting there
        {time && (
          <span className="block text-xs text-muted-foreground">
            about {time.minutes} min by road from you · {time.km} km
          </span>
        )}
      </p>
      <Link
        className="text-sm text-primary underline"
        to="/map"
        search={{
          dest: place.name,
          lat: String(place.lat),
          lng: String(place.lng),
        }}
      >
        Directions to {place.name}
      </Link>
    </div>
  );
}
