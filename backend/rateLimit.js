// Simple in-memory rate limits for public demo protection.
// Resets on process restart — enough for a single Render instance.

const buckets = new Map();

function prune(now, windowMs) {
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart >= windowMs) buckets.delete(key);
  }
}

/**
 * @param {string} key
 * @param {number} limit
 * @param {number} windowMs
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
 */
export function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  if (buckets.size > 5000) prune(now, windowMs);

  let entry = buckets.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { windowStart: now, count: 0 };
    buckets.set(key, entry);
  }

  if (entry.count >= limit) {
    const retryAfterSec = Math.ceil(
      (windowMs - (now - entry.windowStart)) / 1000,
    );
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSec: 0,
  };
}

export function clientIpFromSocket(socket) {
  const xf = socket.handshake.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) {
    return xf.split(",")[0].trim();
  }
  return socket.handshake.address || socket.conn?.remoteAddress || "unknown";
}
