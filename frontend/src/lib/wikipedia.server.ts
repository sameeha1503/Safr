import { z } from "zod";
import { fetchJson } from "./places.server";
import { getCached, setCached } from "./place-cache.server";
import { distanceKm } from "./geo";
import {
  titleMatchScore,
  trimExtract,
  WIKIPEDIA_MATCH_THRESHOLD,
} from "./wikipedia-match";

// Reviewed article links for places whose Wikipedia articles omit coordinates.
// Restrict these exceptions to the known Goa place and its immediate vicinity.
const verifiedArticles = [
  { name: "Palolem Beach", title: "Palolem Beach", lat: 15.01, lng: 74.0232 },
  { name: "Arambol Beach", title: "Arambol", lat: 15.6869, lng: 73.7042 },
];

const webUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//.test(value));
const articleSchema = z.object({
  title: z.string(),
  extract: z.string(),
  imageUrl: webUrl.optional(),
  pageUrl: webUrl,
  license: z.literal("CC BY-SA 4.0"),
});
export type WikipediaArticle = z.infer<typeof articleSchema>;
const searchSchema = z.object({
  query: z.object({
    geosearch: z.array(
      z.object({
        title: z.string(),
        lat: z.number(),
        lon: z.number(),
        dist: z.number(),
      }),
    ),
  }),
});
const summarySchema = z.object({
  type: z.string().optional(),
  title: z.string(),
  extract: z.string(),
  thumbnail: z.object({ source: webUrl }).optional(),
  content_urls: z.object({ desktop: z.object({ page: webUrl }) }),
  coordinates: z.object({ lat: z.number(), lon: z.number() }).optional(),
});

async function loadWikipedia({
  name,
  lat,
  lng,
}: {
  name: string;
  lat: number;
  lng: number;
}): Promise<WikipediaArticle | null> {
  const key = `wikipedia:v3:${name.toLowerCase()}:${lat.toFixed(3)},${lng.toFixed(3)}`;
  try {
    const cached = articleSchema.safeParse(await getCached(key));
    if (cached.success) return cached.data;
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      list: "geosearch",
      gscoord: `${lat}|${lng}`,
      gsradius: "1500",
      gslimit: "8",
      format: "json",
      origin: "*",
    }).toString();
    const result = await fetchJson(url.toString(), {}, 4000)
      .then((value) => searchSchema.parse(value))
      .catch(() => null);
    const candidate = (result?.query.geosearch || [])
      .map((page) => ({ ...page, score: titleMatchScore(name, page.title) }))
      .filter((page) => page.score >= WIKIPEDIA_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score || a.dist - b.dist)[0];
    const verified = verifiedArticles.find(
      (place) =>
        titleMatchScore(name, place.name) === 1 &&
        distanceKm({ lat, lng }, place) <= 1.5,
    );
    // Generic fallback requires matching name AND nearby article coordinates.
    // Only the reviewed local article mappings above can omit coordinates.
    const summary = summarySchema.parse(
      await fetchJson(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate?.title || verified?.title || name)}`,
        {},
        4000,
      ),
    );
    if (
      summary.type === "disambiguation" ||
      titleMatchScore(name, summary.title) < WIKIPEDIA_MATCH_THRESHOLD
    )
      return null;
    if (
      !candidate &&
      !verified &&
      (!summary.coordinates ||
        distanceKm(
          { lat, lng },
          { lat: summary.coordinates.lat, lng: summary.coordinates.lon },
        ) > 3)
    )
      return null;
    const article = articleSchema.parse({
      title: summary.title,
      extract: trimExtract(summary.extract),
      imageUrl: summary.thumbnail?.source,
      pageUrl: summary.content_urls.desktop.page,
      license: "CC BY-SA 4.0",
    });
    await setCached(key, article, 7 * 86400);
    return article;
  } catch {
    return null;
  }
}

const pending = new Map<string, Promise<WikipediaArticle | null>>();
export function lookupWikipedia(place: {
  name: string;
  lat: number;
  lng: number;
}): Promise<WikipediaArticle | null> {
  const key = `${place.name.toLowerCase()}:${place.lat.toFixed(3)},${place.lng.toFixed(3)}`;
  const current = pending.get(key);
  if (current) return current;
  const request = loadWikipedia(place).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
