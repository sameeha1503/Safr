import { drivingMatrix } from "./places.server";
import type { Coordinate } from "./geo";
export async function loadTravelTimes(
  origin: Coordinate,
  destinations: Coordinate[],
): Promise<({ minutes: number; km: number } | null)[]> {
  try {
    const matrix = await drivingMatrix([origin, ...destinations]);
    return destinations.map((_, i) => {
      const seconds = matrix.durations[0]?.[i + 1];
      const metres = matrix.distances[0]?.[i + 1];
      return matrix.reachable[0] &&
        matrix.reachable[i + 1] &&
        seconds != null &&
        metres != null
        ? {
            minutes: Math.round(seconds / 60),
            km: Math.round(metres / 100) / 10,
          }
        : null;
    });
  } catch {
    return destinations.map(() => null);
  }
}
