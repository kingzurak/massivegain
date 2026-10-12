/**
 * Shared Upstash Redis rate limiters. SERVER ONLY.
 *
 * One Redis connection, several named limiters — each route below gets its
 * own key prefix and its own threshold, because "how often should this be
 * called" is very different for a logged-in order placement vs. Paystack's
 * own server hitting our webhook.
 *
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (Upstash
 * dashboard → your database → REST API section). Without them, Redis.fromEnv()
 * throws at import time — every route using a limiter will fail closed with
 * a 500 rather than silently skip rate limiting, which is the safer failure
 * mode for routes that move money.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

/** A logged-in user placing orders: generous enough for normal use, tight enough to stop a script. */
export const orderPlacementLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 s"),
  prefix: "ratelimit:orders:place",
  analytics: true,
});

/** A logged-in user starting a wallet top-up. */
export const walletFundingLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 s"),
  prefix: "ratelimit:paystack:initialize",
  analytics: true,
});

/** The customer's browser bouncing back from Paystack's checkout — keyed by IP, no session required. */
export const paystackCallbackLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "10 s"),
  prefix: "ratelimit:paystack:callback",
  analytics: true,
});

/** Paystack's own servers calling our webhook. Generous — this must never block a legitimate retry. */
export const paystackWebhookLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "10 s"),
  prefix: "ratelimit:paystack:webhook",
  analytics: true,
});

/** Best-effort caller IP on Vercel/most proxies. Falls back to a constant bucket if truly unknown. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** A consistent 429 JSON response, with Retry-After so well-behaved clients can back off correctly. */
export function rateLimitResponse(reset: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return Response.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
