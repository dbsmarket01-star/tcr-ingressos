import { describe, expect, it, beforeEach } from "vitest";
import { assertRateLimit, getRequestIp, resetRateLimitBuckets } from "@/features/security/rate-limit";

describe("rate limiting", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("blocks requests after the configured threshold", () => {
    const key = "tenant-test";

    assertRateLimit(key, { limit: 2, windowMs: 1_000 });
    assertRateLimit(key, { limit: 2, windowMs: 1_000 });

    expect(() => assertRateLimit(key, { limit: 2, windowMs: 1_000 })).toThrow(
      /Muitas tentativas em pouco tempo/
    );
  });

  it("extracts the first forwarded ip when present", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
        "x-real-ip": "127.0.0.1"
      }
    });

    expect(getRequestIp(request)).toBe("10.0.0.1");
  });
});
