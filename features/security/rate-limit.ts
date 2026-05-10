type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

export function assertRateLimit(key: string, options: { limit: number; windowMs: number }) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs
    });
    return;
  }

  if (existing.count >= options.limit) {
    throw new Error("Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.");
  }

  existing.count += 1;
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local";
}

export function resetRateLimitBuckets() {
  buckets.clear();
}
