import { normalizePlaceName } from "./place-names";

/** At least 60% of both names' unique normalized tokens must overlap. Distance alone is insufficient. */
export const WIKIPEDIA_MATCH_THRESHOLD = 0.6;
export function titleMatchScore(name: string, title: string): number {
  const a = new Set(normalizePlaceName(name).split(" ").filter(Boolean));
  // Geographic disambiguators are not part of the landmark's name.
  const unqualifiedTitle = title.replace(/(?:,\s*Goa|\s*\(Goa\))$/i, "");
  const b = new Set(
    normalizePlaceName(unqualifiedTitle).split(" ").filter(Boolean),
  );
  if (!a.size || !b.size) return 0;
  return (
    [...a].filter((token) => b.has(token)).length / Math.max(a.size, b.size)
  );
}
/** Keep only complete sentences, up to three sentences and 450 characters. */
export function trimExtract(
  extract: string,
  maxChars = 450,
  maxSentences = 3,
): string {
  const sentences =
    extract
      .replace(/\s+/g, " ")
      .trim()
      .match(/[^.!?]+[.!?]+(?:["”’']|(?=\s|$))*/g) || [];
  let result = "";
  for (const sentence of sentences.slice(0, maxSentences)) {
    const next = [result, sentence.trim()].filter(Boolean).join(" ");
    if (next.length > maxChars) break;
    result = next;
  }
  return result;
}
