import type { PlaceInsights } from "@/lib/goa-schemas";
import { PlaceImage } from "./PlaceImage";

export function PlaceHero({
  data,
  sunset,
}: {
  data: PlaceInsights;
  sunset?: string | undefined;
}) {
  return (
    <div className="space-y-3">
      <PlaceImage
        src={data.media?.imageUrl}
        name={data.location.name}
        category={data.curated?.kind}
        className={`${data.media?.imageUrl ? "h-56" : "h-24"} w-full rounded-2xl`}
      />
      {data.curated?.kind && (
        <p className="text-sm capitalize text-primary">
          {data.curated.kind.replaceAll("_", " ")}
        </p>
      )}
      {data.curated?.highlight && (
        <p className="font-medium">{data.curated.highlight}</p>
      )}
      {data.curated?.bestTime && (
        <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
          Best time:{" "}
          {data.curated.bestTime === "sunset" && sunset
            ? `sunset · ${sunset}`
            : data.curated.bestTime}
        </span>
      )}
      {!!data.curated?.interests.length && (
        <div className="flex flex-wrap gap-2">
          {data.curated.interests.map((interest) => (
            <span
              key={interest}
              className="rounded-full bg-secondary px-3 py-1 text-xs"
            >
              {interest}
            </span>
          ))}
        </div>
      )}
      {data.wikipedia?.extract && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {data.wikipedia.extract}
        </p>
      )}
      {data.wikipedia && (
        <a
          href={data.wikipedia.pageUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-primary underline"
        >
          Source: Wikipedia ({data.wikipedia.license})
        </a>
      )}
      {data.media && (
        <a
          href={data.media.credit.url}
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-muted-foreground underline"
        >
          Image: {data.media.credit.label}
        </a>
      )}
      {!data.curated?.highlight && !data.wikipedia?.extract && (
        <p className="text-sm text-muted-foreground">{data.summary}</p>
      )}
      {!!data.seasonNotes?.length && (
        <div>
          <h3 className="text-sm font-semibold">Seasonal notes</h3>
          <ul className="list-disc pl-5 text-sm">
            {data.seasonNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
      {data.rules?.not_allowed && data.rules.not_allowed.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
          <h3 className="text-sm font-semibold">Not allowed here</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {data.rules.not_allowed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {!!data.warnings?.length && (
        <div className="space-y-2">
          {data.warnings.map((warning) => (
            <div
              key={warning.title}
              className={`rounded-xl border p-3 text-sm ${
                warning.severity === "high"
                  ? "border-destructive/40 bg-destructive/10"
                  : warning.severity === "medium"
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-muted-foreground/20 bg-muted/40"
              }`}
            >
              <p className="font-semibold">{warning.title}</p>
              <p className="text-muted-foreground">{warning.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
