type RateLimitRecord = {
  timestamps: number[];
};

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5;

const ipStore = new Map<string, RateLimitRecord>();
const codeStore = new Map<string, RateLimitRecord>();

function cleanStore(store: Map<string, RateLimitRecord>, now: number) {
  for (const [key, record] of store.entries()) {
    const valid = record.timestamps.filter((ts) => now - ts < WINDOW_MS);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      record.timestamps = valid;
    }
  }
}

export function checkRateLimit(
  ip: string,
  code: string,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  cleanStore(ipStore, now);
  cleanStore(codeStore, now);

  const ipRecord = ipStore.get(ip) || { timestamps: [] };
  const codeRecord = codeStore.get(code.toUpperCase()) || { timestamps: [] };

  const recentIp = ipRecord.timestamps.filter((ts) => now - ts < WINDOW_MS);
  const recentCode = codeRecord.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (recentIp.length >= MAX_REQUESTS || recentCode.length >= MAX_REQUESTS) {
    const oldestIp = recentIp[0] || now;
    const oldestCode = recentCode[0] || now;
    const oldest = Math.min(oldestIp, oldestCode);
    const retryAfterSec = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  recentIp.push(now);
  recentCode.push(now);

  ipStore.set(ip, { timestamps: recentIp });
  codeStore.set(code.toUpperCase(), { timestamps: recentCode });

  return { allowed: true };
}

export function sanitizeText(input: unknown, maxLength: number): string | null {
  if (typeof input !== "string") return null;
  const stripped = input
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .trim();
  if (!stripped) return null;
  return stripped.slice(0, maxLength);
}

export function sanitizeCoordinates(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val !== "number" && typeof val !== "string") return null;
  if (typeof val === "string" && !val.trim()) return null;
  const num = typeof val === "number" ? val : Number(val);
  if (isNaN(num) || !isFinite(num)) return null;
  return num;
}
