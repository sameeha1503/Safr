/** Sliding window, scoped to this server process. Inject a clock for deterministic tests. */
export function createRateLimiter({
  windowMs,
  max,
  clock = Date.now,
}: {
  windowMs: number;
  max: number;
  clock?: () => number;
}) {
  if (windowMs <= 0 || max < 1)
    throw new Error("Invalid rate limiter settings");
  const windows = new Map<string, number[]>();
  return {
    check(key: string): { allowed: boolean; retryAfterSec?: number } {
      const now = clock();
      for (const [id, times] of windows) {
        const recent = times.filter((time) => time > now - windowMs);
        if (recent.length) windows.set(id, recent);
        else windows.delete(id);
      }
      const times = windows.get(key) || [];
      if (times.length >= max)
        return {
          allowed: false,
          retryAfterSec: Math.max(
            1,
            Math.ceil((times[0]! + windowMs - now) / 1000),
          ),
        };
      windows.set(key, [...times, now]);
      return { allowed: true };
    },
  };
}
