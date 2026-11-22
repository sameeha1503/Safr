import type { ScoredRoute } from "@/lib/maps.server";
import { Button } from "@/components/ui/button";
import { createOfflineTrip } from "../lib/offline-trip";

export function RouteEvidence({ route }: { route: ScoredRoute }) {
  const evidence = route.safety;
  return (
    <details className="rounded-xl border p-3 text-sm">
      <summary className="cursor-pointer min-h-11 font-semibold">
        Road evidence & offline trip
      </summary>
      <p className="my-2 text-xs text-muted-foreground">
        OpenStreetMap road tags, assessed when this route was calculated.
        Coverage measures available map data, not how safe a road is. No live
        traffic, crime or official hazard feed.
      </p>
      <dl className="space-y-2">
        {[
          ["Matched road coverage", evidence.coveragePercent],
          ["Road condition coverage", evidence.conditionCoveragePercent],
          ["Lighting coverage", evidence.lightingCoveragePercent],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt>{label}</dt>
            <dd>
              {typeof value === "number" && Number.isFinite(value)
                ? `${Math.round(value)}%`
                : "Unknown"}
            </dd>
          </div>
        ))}
      </dl>
      <p className="my-3 text-xs">
        {evidence.sufficient
          ? "Enough mapped evidence for a relative comparison; this is not a safety guarantee."
          : "Insufficient evidence to recommend a safer route."}
      </p>
      <Button
        variant="outline"
        className="min-h-11"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([createOfflineTrip(route, new Date().toISOString())], {
              type: "text/html;charset=utf-8",
            }),
          );
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "safr-offline-trip.html";
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Download offline directions
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        Includes turn instructions and emergency contacts. Open the downloaded
        file before travelling to check it works on your phone.
      </p>
    </details>
  );
}
