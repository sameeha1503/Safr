import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlaceEssentials } from "@/lib/goa.functions";
import { EMERGENCY_NUMBERS } from "@/lib/emergency-contacts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_LABELS: Record<string, string> = {
  hospital: "Hospitals",
  police: "Police Stations",
  pharmacy: "Pharmacies",
  clinic: "Clinics",
};

export function SafetyEssentialsCard({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  const get = useServerFn(getPlaceEssentials);
  const query = useQuery({
    queryKey: ["explore-essentials", lat, lng],
    queryFn: () => get({ data: { lat, lng } }),
    staleTime: 86400000,
    retry: false,
  });
  return (
    <section className="rounded-3xl border border-border bg-card p-6 space-y-3">
      <h3 className="font-bold text-lg">Safety essentials</h3>
      {query.isPending ? (
        <Skeleton className="h-24" aria-label="Loading nearby essentials" />
      ) : query.isError || query.data === null ? (
        <div>
          <p className="text-sm">Nearby essentials could not be loaded.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry essentials
          </Button>
        </div>
      ) : query.data && query.data.length > 0 ? (
        <div className="space-y-4">
          {Object.entries(
            query.data.reduce<Record<string, typeof query.data>>((acc, item) => {
              (acc[item.kind] = acc[item.kind] || []).push(item);
              return acc;
            }, {}),
          ).map(([kind, items]) => (
            <div key={kind} className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {CATEGORY_LABELS[kind] || kind} ({items.length})
              </h4>
              <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-secondary/20 px-3">
                {items.map((item) => (
                  <div
                    key={`${item.kind}-${item.name}-${item.lat}-${item.lng}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.distanceKm.toFixed(1)} km straight-line
                        {item.openingHours
                          ? ` · Listed hours: ${item.openingHours}`
                          : ""}
                      </p>
                    </div>
                    <Link
                      className="text-xs text-primary hover:underline shrink-0 font-medium"
                      to="/map"
                      search={{
                        dest: item.name,
                        lat: String(item.lat),
                        lng: String(item.lng),
                      }}
                    >
                      Open on Map
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No nearby essentials found within 10 km.
        </p>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(EMERGENCY_NUMBERS).map(([label, phone]) => (
          <a
            key={label}
            className="capitalize text-primary underline"
            href={`tel:${phone}`}
          >
            {label}: {phone}
          </a>
        ))}
      </div>
    </section>
  );
}
