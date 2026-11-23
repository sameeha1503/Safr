import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, ShieldQuestion, TriangleAlert } from "lucide-react";
import { getTravelTimes } from "@/lib/goa.functions";
import { getRoutes } from "@/lib/maps.functions";
import { explainRouteChoice } from "@/lib/route-choice";
import { isGoaNight } from "@/features/map/lib/goa-time";
import { Skeleton } from "@/components/ui/skeleton";
import type { Coordinate } from "@/lib/geo";

export function GettingThere({
  place,
  origin,
}: {
  place: Coordinate & { name: string };
  origin: Coordinate | null;
}) {
  const get = useServerFn(getTravelTimes);
  const fetchRoutes = useServerFn(getRoutes);
  const isNight = isGoaNight();

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

  // The same engine the Map page uses, so Explore and Map always agree.
  const routesQuery = useQuery({
    queryKey: [
      "explore-route-safety",
      origin?.lat,
      origin?.lng,
      place.lat,
      place.lng,
      isNight,
    ],
    enabled: Boolean(origin),
    queryFn: () =>
      fetchRoutes({
        data: {
          origin: origin!,
          destination: { lat: place.lat, lng: place.lng, name: place.name },
          waypoints: [],
          mode: "car",
          isNight,
        },
      }),
    staleTime: 300000,
    retry: false,
  });

  const choice = useMemo(
    () =>
      routesQuery.data && routesQuery.data.length > 0
        ? explainRouteChoice(routesQuery.data, { isNight })
        : null,
    [routesQuery.data, isNight],
  );

  const time = query.data?.[0];
  const mapSearch = {
    dest: place.name,
    lat: String(place.lat),
    lng: String(place.lng),
  };

  const tone =
    choice?.verdict === "safer-alternative" ||
    choice?.verdict === "fastest-is-safest"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : "border-border bg-secondary/30";

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          search={mapSearch}
        >
          {choice?.verdict === "safer-alternative"
            ? "See both routes on the map"
            : `Directions to ${place.name}`}
        </Link>
      </div>

      {!origin && (
        <p className="text-xs text-muted-foreground">
          Allow location access to see whether a safer route is available.
        </p>
      )}

      {origin && routesQuery.isPending && (
        <Skeleton
          className="h-20 rounded-xl"
          aria-label="Comparing routes for safety"
        />
      )}

      {origin && routesQuery.isError && (
        <p className="text-xs text-muted-foreground">
          Route safety comparison is unavailable right now. Open the map for
          directions.
        </p>
      )}

      {choice && (
        <section
          className={`space-y-2 rounded-xl border p-3 ${tone}`}
          aria-label="Route safety comparison"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            {choice.verdict === "unclear" ? (
              <ShieldQuestion className="size-4 shrink-0" aria-hidden />
            ) : (
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
            )}
            {choice.headline}
          </p>

          {choice.verdict === "safer-alternative" &&
            choice.fastest &&
            choice.safer && (
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-background/60 p-2">
                  <dt className="text-muted-foreground">Fastest</dt>
                  <dd className="font-medium">
                    {choice.fastest.durationMin} min ·{" "}
                    {choice.fastest.distanceKm} km
                  </dd>
                </div>
                <div className="rounded-lg bg-background/60 p-2">
                  <dt className="text-muted-foreground">Safer</dt>
                  <dd className="font-medium">
                    {choice.safer.durationMin} min · {choice.safer.distanceKm}{" "}
                    km
                  </dd>
                </div>
              </dl>
            )}

          <div>
            <p className="text-xs font-semibold">
              {choice.verdict === "unclear" ? "Why not?" : "Why"}
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
              {choice.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          {choice.verdict !== "unclear" &&
            choice.hazardsOnRecommended.length > 0 && (
              <p className="flex items-start gap-2 text-xs">
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                Passes known accident-prone area:{" "}
                {choice.hazardsOnRecommended.join(", ")}.
              </p>
            )}

          <p className="text-[11px] text-muted-foreground">
            Based on OpenStreetMap road tags
            {isNight ? " and night-time lighting" : ""} plus locally reported
            accident-prone spots. No live traffic or crime data. This is general
            guidance, not a safety guarantee.
          </p>
        </section>
      )}
    </div>
  );
}
