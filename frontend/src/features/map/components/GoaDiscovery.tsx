import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Search, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CATALOGUE_CATEGORIES,
  ESSENTIAL_FILTERS,
  matchesEssential,
  type EssentialFilter,
  catalogueCategory,
  cataloguePickedPlace,
  filterCatalogue,
  type CatalogueCategory,
  type GoaCatalogue,
} from "../lib/goa-catalogue";
import type { PickedPlace } from "../lib/place-picking";

export function GoaDiscovery({
  map,
  onPick,
}: {
  map: MapLibreMap | null;
  onPick: (place: PickedPlace) => void;
}) {
  const [category, setCategory] = useState<CatalogueCategory>("All");
  const [essential, setEssential] = useState<EssentialFilter | "All">("All");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const { data, isPending, isError, refetch } = useQuery<GoaCatalogue>({
    queryKey: ["goa-catalogue"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/data/goa-places.json", { signal });
      if (!response.ok) throw new Error("Place catalogue unavailable");
      const result = (await response.json()) as GoaCatalogue;
      if (!Array.isArray(result.places))
        throw new Error("Invalid place catalogue");
      return result;
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  const filtered = useMemo(
    () =>
      filterCatalogue(data?.places || [], category, query)
        .filter((place) => matchesEssential(place, essential))
        .sort((a, b) =>
          (a.tags["name:en"] || a.tags["name"] || "").localeCompare(
            b.tags["name:en"] || b.tags["name"] || "",
          ),
        ),
    [data, category, query, essential],
  );
  function select(place: PickedPlace) {
    onPick(place);
    map?.flyTo({
      center: [place.lng, place.lat],
      zoom: Math.max(map.getZoom(), 14),
      padding: { left: 0, right: 0, top: 80, bottom: 80 },
    });
    if (window.innerWidth < 1024)
      map
        ?.getContainer()
        .scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 space-y-3"
      aria-label="Discover Goa"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-lg">Discover Goa</h2>
          <p className="text-xs text-muted-foreground">
            Find a place. Make it part of your trip.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!map}
          onClick={() =>
            map?.fitBounds(
              [
                [73.65, 14.89],
                [74.34, 15.82],
              ],
              { padding: 40 },
            )
          }
        >
          All Goa
        </Button>
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          className="min-w-0 w-full bg-transparent text-sm outline-none"
          aria-label="Search the Goa place catalogue"
          placeholder="Beach, village, café, cuisine…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(20);
          }}
        />
      </label>
      <div className="flex gap-1.5 flex-wrap" aria-label="Place categories">
        {CATALOGUE_CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            onClick={() => {
              setCategory(value);
              setEssential("All");
              setLimit(20);
            }}
            className={`rounded-full border px-2.5 py-1.5 text-xs transition-colors ${category === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="text-xs text-muted-foreground">
        <label className="block mb-3">
          Transport & essentials
          <select
            className="mt-1 block min-h-11 w-full rounded-lg border bg-background px-2 text-foreground"
            value={essential}
            onChange={(event) => {
              setEssential(event.target.value as EssentialFilter | "All");
              setCategory("All");
              setLimit(20);
            }}
          >
            <option value="All">All places</option>
            {Object.keys(ESSENTIAL_FILTERS).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        {essential !== "All" && (
          <p className="mb-2">
            Mapped locations only. Opening hours, ferry service and availability
            are not live; confirm locally. Missing results do not mean no
            service exists.
          </p>
        )}
        {isPending
          ? "Loading Goa places…"
          : isError
            ? "The place catalogue could not be loaded."
            : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "place" : "places"} · ${data?.places.length.toLocaleString()} in the Goa catalogue`}
      </div>
      {isError && (
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="h-3 w-3 mr-2" />
          Retry
        </Button>
      )}
      {!isPending && !isError && filtered.length === 0 && (
        <p className="text-sm py-3">
          No matches. Try another category or search term.
        </p>
      )}
      <div className="max-h-60 overflow-y-auto divide-y divide-border/50">
        {filtered.slice(0, limit).map((place) => (
          <button
            key={place.id}
            type="button"
            onClick={() => select(cataloguePickedPlace(place))}
            className="flex w-full items-center gap-3 py-3 px-1 text-left hover:bg-secondary/60 rounded-lg"
          >
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-sm font-medium truncate">
                {place.tags["name:en"] || place.tags["name"]}
              </span>
              <span className="block text-xs text-muted-foreground">
                {catalogueCategory(place)}
                {place.tags["addr:city"] ? ` · ${place.tags["addr:city"]}` : ""}
              </span>
            </span>
          </button>
        ))}
        {filtered.length > limit && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setLimit((value) => value + 30)}
          >
            Show more places
          </Button>
        )}
      </div>
      {data && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          ©{" "}
          <a
            className="underline"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap contributors
          </a>{" "}
          · ODbL. Snapshot{" "}
          {new Date(data.osmTimestamp || data.fetchedAt).toLocaleDateString(
            "en-IN",
            { timeZone: "Asia/Kolkata" },
          )}
          . Coverage and business details may be incomplete.
        </p>
      )}
    </section>
  );
}
