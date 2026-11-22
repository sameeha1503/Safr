import { NearbyPlaceDetails } from "./NearbyPlaceDetails";
import { ResultsMap } from "./ResultsMap";
import { resultKey } from "@/lib/explore-results";
import { parseOpeningHours } from "@/lib/opening-hours";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getTravelTimes } from "@/lib/goa.functions";
import { getPlaceMedia } from "@/lib/goa.functions";
import type { PlaceInsights } from "@/lib/goa-schemas";
import type { Coordinate } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { PlaceImage } from "./PlaceImage";

export type SaveExplorePlace = (place: {
  name: string;
  category?: string | undefined;
  imageUrl?: string | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
}) => void;
export function NearbyRecommendations({
  data,
  origin,
  onSave,
  isSaved,
}: {
  data: PlaceInsights;
  origin: Coordinate | null;
  onSave: SaveExplorePlace;
  isSaved: (name: string) => boolean;
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const selectPin = useCallback((key: string) => {
    setSelected(key);
    cards.current
      .get(key)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    cards.current.get(key)?.focus({ preventScroll: true });
  }, []);
  const [sort, setSort] = useState<"nearest" | "road">("nearest");
  const [openNow, setOpenNow] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const hours = (item: PlaceInsights["eat"][number]) =>
    parseOpeningHours(item.openingHours, now);
  const travel = useServerFn(getTravelTimes);
  const placeMedia = useServerFn(getPlaceMedia);
  const items = useMemo(
    () => [...data.eat, ...data.activities, ...data.sights],
    [data],
  );
  const destinations = useMemo(
    () =>
      items.filter(
        (item): item is typeof item & Coordinate =>
          item.lat != null && item.lng != null,
      ),
    [items],
  );
  const mediaInput = useMemo(
    () =>
      items.slice(0, 30).map((item) => ({
        key: resultKey(item),
        name: item.name,
        ...(item.lat != null ? { lat: item.lat } : {}),
        ...(item.lng != null ? { lng: item.lng } : {}),
      })),
    [items],
  );
  const media = useQuery({
    queryKey: ["explore-nearby-media", mediaInput],
    queryFn: () => placeMedia({ data: mediaInput }),
    enabled: view === "list" && mediaInput.length > 0,
    staleTime: 7 * 86400000,
    retry: false,
  });
  const start = origin || data.location;
  const times = useQuery({
    queryKey: [
      "explore-road-times",
      start.lat,
      start.lng,
      destinations.map((item) => [item.name, item.lat, item.lng]),
    ],
    queryFn: async () => {
      const batches = [];
      for (let i = 0; i < destinations.length; i += 12)
        batches.push(
          travel({
            data: {
              origin: start,
              destinations: destinations
                .slice(i, i + 12)
                .map((item) => ({ lat: item.lat, lng: item.lng })),
            },
          }),
        );
      return (await Promise.all(batches)).flat();
    },
    enabled: destinations.length > 0,
    staleTime: 300000,
    retry: false,
  });
  const byPlace = new Map(
    destinations.map((item, i) => [
      `${item.name}:${item.lat},${item.lng}`,
      times.data?.[i],
    ]),
  );
  const timeFor = (item: (typeof items)[number]) =>
    byPlace.get(`${item.name}:${item.lat},${item.lng}`);
  const groups = [
    ["Where to eat", data.eat, "food"],
    ["Things to do", data.activities, "activity"],
    ["Sights & landmarks", data.sights, "sight"],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-lg">Nearby places</h3>
        <div role="group" aria-label="Results view" className="flex gap-1">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </Button>
          <Button
            variant={view === "map" ? "default" : "outline"}
            size="sm"
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
          >
            Map
          </Button>
        </div>
        <label className="text-sm flex gap-2 items-center">
          <input
            type="checkbox"
            checked={openNow}
            onChange={(e) => setOpenNow(e.target.checked)}
          />
          Open now
        </label>
        <label className="text-sm">
          Sort{" "}
          <select
            className="rounded-lg border border-border bg-card p-2 ml-1"
            value={sort}
            onChange={(e) =>
              setSort(e.target.value === "road" ? "road" : "nearest")
            }
          >
            <option value="nearest">Nearest</option>
            <option value="road">Quickest by road</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Travel times {origin ? "from you" : `from ${data.location.name}`} ·
        Driving estimates without live traffic.
      </p>
      {times.isError && (
        <div className="text-sm">
          Road times could not be loaded.{" "}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void times.refetch()}
          >
            Retry road times
          </Button>
        </div>
      )}
      {view === "map" && (
        <ResultsMap
          centre={data.location}
          places={destinations.filter(
            (item) => !openNow || hours(item).isOpen !== false,
          )}
          onSelect={selectPin}
        />
      )}
      {groups.map(
        ([title, entries, category]) =>
          entries.length > 0 && (
            <section
              key={title}
              className="rounded-3xl border border-border bg-card p-6"
            >
              <h4 className="font-semibold mb-3">{title}</h4>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[...entries]
                  .filter((item) => !openNow || hours(item).isOpen !== false)
                  .sort((a, b) =>
                    sort === "road"
                      ? (timeFor(a)?.minutes ?? Infinity) -
                        (timeFor(b)?.minutes ?? Infinity)
                      : (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
                  )
                  .map((item) => {
                    const photo = media.data?.[resultKey(item)];
                    return (
                      <article
                        key={resultKey(item)}
                        tabIndex={-1}
                        ref={(node) => {
                          if (node) cards.current.set(resultKey(item), node);
                          else cards.current.delete(resultKey(item));
                        }}
                        aria-label={
                          selected === resultKey(item)
                            ? `${item.name}, selected on map`
                            : item.name
                        }
                        style={
                          selected === resultKey(item)
                            ? { outline: "2px solid var(--primary)" }
                            : undefined
                        }
                        className="rounded-2xl bg-secondary/30 border border-border p-4 space-y-2"
                      >
                        <div className="relative -mx-1 -mt-1">
                          <PlaceImage
                            src={photo?.imageUrl}
                            name={item.name}
                            category={category}
                            className="h-28 w-full rounded-xl"
                            pending={media.isFetching}
                          />
                          {photo?.credit && (
                            <a
                              href={photo.credit.url}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[9px] text-white"
                            >
                              Attribution
                            </a>
                          )}
                        </div>
                        <h5 className="font-semibold text-sm">{item.name}</h5>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                        {hours(item).statusBadge && (
                          <p className="text-xs font-medium">
                            {hours(item).statusBadge}
                          </p>
                        )}
                        {item.openingHours && (
                          <p className="text-xs">
                            Listed hours: {item.openingHours}
                          </p>
                        )}
                        {timeFor(item) && (
                          <p className="text-xs font-medium text-primary">
                            about {timeFor(item)!.minutes} min by road ·{" "}
                            {timeFor(item)!.km} km
                          </p>
                        )}
                        {item.lat != null && item.lng != null && (
                          <NearbyPlaceDetails
                            place={{
                              name: item.name,
                              lat: item.lat,
                              lng: item.lng,
                            }}
                          />
                        )}
                        <div className="flex gap-3 items-center flex-wrap">
                          {item.lat != null && item.lng != null && (
                            <Link
                              className="text-xs text-primary underline"
                              to="/map"
                              search={{
                                dest: item.name,
                                lat: String(item.lat),
                                lng: String(item.lng),
                              }}
                            >
                              Directions
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              onSave({
                                name: item.name,
                                category,
                                imageUrl: photo?.imageUrl,
                                lat: item.lat,
                                lng: item.lng,
                              })
                            }
                          >
                            {isSaved(item.name)
                              ? "Saved"
                              : "Add to bucket list"}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </section>
          ),
      )}
      <p className="text-xs text-muted-foreground">
        Unknown opening hours stay visible when filtering. Nearby OpenStreetMap
        listings may be incomplete or out of date. Distances are straight-line
        unless labelled by road.
      </p>
    </div>
  );
}
