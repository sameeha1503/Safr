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
        traffic or crime feed. Known accident-prone locations (sourced from
        local news reports) are checked separately and shown below.
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
      {route.hazardZones.length > 0 && (
        <div className="my-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 space-y-1">
          <p className="text-xs font-semibold">
            ⚠ Known accident-prone zone{route.hazardZones.length > 1 ? "s" : ""} on this route
          </p>
          {route.hazardZones.map((zone) => (
            <div key={zone.id} className="text-xs">
              <span className="font-medium">{zone.label}</span> —{" "}
              {zone.description}{" "}
              <a
                href={zone.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                source
              </a>
            </div>
          ))}
        </div>
      )}
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
