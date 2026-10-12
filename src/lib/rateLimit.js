/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * No external dependency (no Redis) to keep the project self-contained. Each
 * key gets a budget of `limit` requests per `windowMs`; the first request in a
 * window stamps the window's expiry.
 *
 * LIMITATION: state lives in this process's memory. On a single server it's
 * accurate. On serverless (e.g. Vercel) each instance has its own map, so the
 * effective limit is `limit` PER INSTANCE — still a meaningful speed bump
 * against casual abuse, but not a hard global cap. For a strict global limit,
 * swap the map for a shared store (Upstash/Redis) without changing callers.
 */

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

// Periodically drop expired buckets so the map can't grow unbounded.
let lastSweep = Date.now();
function sweep(now) {
  if (now - lastSweep < 60_000) {
    return;
  }
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/**
 * @param {string} key - Identifier to rate-limit (e.g. the user id or IP).
 * @param {{ limit: number, windowMs: number }} options
 * @returns {{ success: boolean, remaining: number, resetAt: number }}
 */
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const success = bucket.count <= limit;
  const remaining = Math.max(0, limit - bucket.count);

  return { success, remaining, resetAt: bucket.resetAt };
}

/** Helper to build a standard 429 response for route handlers. */
export function tooManyRequests(retryAfterMs) {
  const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please slow down and try again shortly.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
