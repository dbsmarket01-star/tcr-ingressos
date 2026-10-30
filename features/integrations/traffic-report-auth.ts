import { createHash, timingSafeEqual } from "node:crypto";

/** A dedicated, server-side secret. Never accept it in a URL or browser cookie. */
export function isTrafficReportAuthorized(request: Request) {
  const expected = process.env.TRAFFIC_REPORT_API_TOKEN;
  if (!expected || expected.length < 32) return false;
  const authorization = request.headers.get("authorization")?.trim();
  const supplied = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1]
    // Claude custom connectors may send a fixed authorization value verbatim.
    ?? (authorization && /^[a-f0-9]{96}$/i.test(authorization) ? authorization : null);
  if (!supplied) return false;
  return timingSafeEqual(
    createHash("sha256").update(supplied).digest(),
    createHash("sha256").update(expected).digest()
  );
}
