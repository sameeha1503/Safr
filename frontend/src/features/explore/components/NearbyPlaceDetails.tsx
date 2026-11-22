import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlaceDetails } from "@/lib/maps.functions";
import type { Coordinate } from "@/lib/geo";
import { Button } from "@/components/ui/button";

export function NearbyPlaceDetails({
  place,
}: {
  place: Coordinate & { name: string };
}) {
  const [open, setOpen] = useState(false);
  const getDetails = useServerFn(getPlaceDetails);
  const query = useQuery({
    queryKey: ["place-details", place.name, place.lat, place.lng],
    queryFn: () => getDetails({ data: place }),
    enabled: open,
    staleTime: 86400000,
    retry: false,
  });
  const data = query.data;
  const website =
    data?.website && /^https?:\/\//i.test(data.website)
      ? data.website
      : undefined;
  return (
    <div className="text-xs space-y-2">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide details" : "Place details"}
      </Button>
      {open &&
        (query.isPending ? (
          <p role="status">Loading details…</p>
        ) : query.isError ? (
          <p>
            Details could not be loaded.{" "}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void query.refetch()}
            >
              Retry details
            </Button>
          </p>
        ) : (
          <div className="space-y-1">
            {data?.openingHours && <p>Listed hours: {data.openingHours}</p>}
            {data?.cuisine && (
              <p>Cuisine: {data.cuisine.replaceAll(";", ", ")}</p>
            )}
            {data?.phone && <p>Phone: {data.phone}</p>}
            {website && (
              <a
                className="block text-primary underline"
                href={website}
                target="_blank"
                rel="noreferrer"
              >
                Website
              </a>
            )}
            {!data?.openingHours &&
              !data?.cuisine &&
              !data?.phone &&
              !website && <p>No further details were returned.</p>}
            {(data?.openingHours ||
              data?.cuisine ||
              data?.phone ||
              website) && (
              <p className="text-muted-foreground">Source: OpenStreetMap</p>
            )}
          </div>
        ))}
    </div>
  );
}
