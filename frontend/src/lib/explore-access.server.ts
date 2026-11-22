import { getRequest } from "@tanstack/react-start/server";
import { createRateLimiter } from "./rate-limiter.server";

const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });
export function checkExploreAccess(userId?: string) {
  const headers = getRequest().headers;
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "127.0.0.1";
  const result = limiter.check(userId ? `user:${userId}` : `ip:${ip}`);
  if (!result.allowed)
    throw new Error(
      `Please wait ${result.retryAfterSec} seconds before requesting more place information.`,
    );
}
