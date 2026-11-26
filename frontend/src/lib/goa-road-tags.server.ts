import type { RoadWay } from "./route-comparison";
import rawSnapshot from "../../public/data/goa-road-tags.json" with { type: "json" };

let cachedWaysMap: Map<number, Record<string, string>> | null = null;

function getLoadedSnapshotWays(): Map<number, Record<string, string>> {
  if (cachedWaysMap) return cachedWaysMap;

  const map = new Map<number, Record<string, string>>();
  if (
    rawSnapshot &&
    typeof rawSnapshot === "object" &&
    "ways" in rawSnapshot &&
    rawSnapshot["ways"] &&
    typeof rawSnapshot["ways"] === "object"
  ) {
    const waysRecord = rawSnapshot["ways"] as Record<
      string,
      Record<string, string>
    >;
    for (const [idStr, tags] of Object.entries(waysRecord)) {
      const idNum = Number(idStr);
      if (Number.isFinite(idNum) && tags && typeof tags === "object") {
        map.set(idNum, tags);
      }
    }
  }

  cachedWaysMap = map;
  return map;
}

export function roadWaysFromSnapshot(ids: number[]): RoadWay[] {
  const waysMap = getLoadedSnapshotWays();
  const matched: RoadWay[] = [];

  for (const id of ids) {
    const tags = waysMap.get(id);
    if (tags) {
      matched.push({
        id,
        nodes: [],
        tags,
      });
    }
  }

  return matched;
}
