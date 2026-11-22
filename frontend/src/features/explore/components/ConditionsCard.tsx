import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatGoaTime,
  type PlaceConditions,
  type Advisory,
} from "@/lib/conditions";

export function ConditionsCard({
  data,
  pending,
  error,
  onRetry,
}: {
  data:
    { conditions: PlaceConditions | null; advisories: Advisory[] } | undefined;
  pending: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (pending)
    return (
      <Skeleton className="h-40 rounded-3xl" aria-label="Loading conditions" />
    );
  if (error || data?.conditions === null)
    return (
      <section className="rounded-3xl border p-5">
        <p>Conditions could not be loaded.</p>
        <Button variant="outline" onClick={onRetry}>
          Retry conditions
        </Button>
      </section>
    );
  const conditions = data?.conditions;
  if (!conditions) return null;
  const w = conditions.weather;
  const m = conditions.marine;
  const rows: [string, string | undefined][] = [
    ["Temperature", w?.temperature != null ? `${w.temperature} °C` : undefined],
    ["Feels like", w?.feelsLike != null ? `${w.feelsLike} °C` : undefined],
    [
      "Rain chance today",
      w?.rainChance != null ? `${w.rainChance}%` : undefined,
    ],
    ["Wind", w?.wind != null ? `${w.wind} km/h` : undefined],
    ["Maximum UV today", w?.uv != null ? String(w.uv) : undefined],
    ["Sunrise", formatGoaTime(w?.sunrise)],
    ["Sunset", formatGoaTime(w?.sunset)],
  ];
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-6 space-y-4">
        <div className="flex justify-between flex-wrap gap-2">
          <h3 className="font-bold text-lg">Weather & sea conditions</h3>
          {formatGoaTime(conditions.updatedAt) && (
            <span className="text-xs text-muted-foreground">
              Updated {formatGoaTime(conditions.updatedAt)} IST
            </span>
          )}
        </div>
        {w && (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {rows
              .filter(([, value]) => value != null)
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
          </dl>
        )}
        {m && (
          <div className="border-t pt-3">
            <h4 className="font-medium text-sm">Sea forecast</h4>
            <div className="flex flex-wrap gap-4 text-sm mt-2">
              {m.waveHeight != null && <span>Waves {m.waveHeight} m</span>}
              {m.wavePeriod != null && (
                <span>Wave period {m.wavePeriod} s</span>
              )}
              {m.swellHeight != null && <span>Swell {m.swellHeight} m</span>}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Source:{" "}
          <a
            className="underline"
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
          >
            Open-Meteo
          </a>{" "}
          · Modelled forecast, not on-site measurements.
        </p>
      </section>
      {!!data?.advisories.length && (
        <section className="space-y-3" aria-label="General guidance">
          <h3 className="font-bold">General guidance</h3>
          {data.advisories.map((advice) => (
            <div
              key={advice.title}
              className={`rounded-2xl border-l-4 p-4 bg-card ${advice.severity === "high" ? "border-destructive" : advice.severity === "medium" ? "border-amber-500" : "border-blue-500"}`}
            >
              <p className="font-semibold text-sm">{advice.title}</p>
              <p className="text-sm text-muted-foreground">{advice.detail}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
