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
    </div>
  );
}
