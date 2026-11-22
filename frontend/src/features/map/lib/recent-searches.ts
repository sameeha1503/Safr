import type { Hit } from "./types";

export const RECENT_SEARCHES_KEY = "safr_recent_destinations";

export function getRecentSearches(): Hit[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Hit[]).slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(hit: Hit): void {
  try {
    const recents = getRecentSearches().filter(
      (r) => r.name.toLowerCase() !== hit.name.toLowerCase(),
    );
    recents.unshift(hit);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(recents.slice(0, 5)),
    );
  } catch {
    // ignore localStorage errors
  }
}
