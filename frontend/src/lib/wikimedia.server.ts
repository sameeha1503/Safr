import { z } from "zod";

import { getCached, setCached } from "./place-cache.server";
import { fetchJson } from "./places.server";

const webUrl = z
  .string()
  .url()
  .refine((value) => /^https:\/\//.test(value));

const commonsResponseSchema = z.object({
  query: z
    .object({
      pages: z.record(
        z.string(),
        z.object({
          index: z.number().optional(),
          title: z.string(),
          imageinfo: z
            .array(
              z.object({
                thumburl: webUrl.optional(),
                url: webUrl.optional(),
                descriptionurl: webUrl,
                mime: z.string(),
              }),
            )
            .optional(),
        }),
      ),
    })
    .optional(),
});

const mediaSchema = z.object({
  imageUrl: webUrl,
  credit: z.object({ label: z.string(), url: webUrl }),
});
export type PlaceMedia = z.infer<typeof mediaSchema>;

const IGNORED_IMAGE_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "file",
  "goa",
  "in",
  "india",
  "of",
  "the",
]);
const REJECTED_IMAGE_WORDS = new Set(["flag", "icon", "logo", "map", "seal"]);

function mediaTokens(value: string): string[] {
  return value
    .replace(/^file:/i, "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) =>
      token.length > 5 && token.endsWith("s") ? token.slice(0, -1) : token,
    )
    .filter((token) => !IGNORED_IMAGE_WORDS.has(token));
}

/** Every meaningful place-name token must occur in the Commons filename. */
export function imageTitleMatchScore(name: string, fileTitle: string): number {
  const expected = new Set(mediaTokens(name));
  const actual = new Set(mediaTokens(fileTitle));
  if (!expected.size || !actual.size) return 0;
  if ([...actual].some((token) => REJECTED_IMAGE_WORDS.has(token))) return 0;
  const overlap = [...expected].filter((token) => actual.has(token)).length;
  return overlap / expected.size;
}

export async function lookupWikimediaImage({
  name,
}: {
  name: string;
  lat?: number | undefined;
  lng?: number | undefined;
}): Promise<PlaceMedia | null> {
  const key = `wikimedia-image:v1:${name.trim().toLowerCase()}`;
  try {
    const cached = mediaSchema.safeParse(await getCached(key));
    if (cached.success) return cached.data;

    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${name} Goa`,
      gsrnamespace: "6",
      gsrlimit: "8",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "1200",
      format: "json",
      origin: "*",
    }).toString();
    const response = commonsResponseSchema.parse(
      await fetchJson(url.toString(), {}, 5000),
    );
    const candidate = Object.values(response.query?.pages ?? {})
      .flatMap((page) => {
        const image = page.imageinfo?.[0];
        const score = imageTitleMatchScore(name, page.title);
        return image &&
          score === 1 &&
          ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
            image.mime,
          ) &&
          (image.thumburl || image.url)
          ? [{ page, image, score }]
          : [];
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          (a.page.index ?? Number.MAX_SAFE_INTEGER) -
            (b.page.index ?? Number.MAX_SAFE_INTEGER),
      )[0];
    if (!candidate) return null;

    const media = mediaSchema.parse({
      imageUrl: candidate.image.thumburl || candidate.image.url,
      credit: {
        label: "Wikimedia Commons — view license and attribution",
        url: candidate.image.descriptionurl,
      },
    });
    await setCached(key, media, 7 * 86400);
    return media;
  } catch {
    return null;
  }
}
