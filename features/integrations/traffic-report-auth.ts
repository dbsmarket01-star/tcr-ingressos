import { createHash, timingSafeEqual } from "node:crypto";

/** A dedicated, server-side secret. Never accept it in a URL or browser cookie. */
export function isTrafficReportAuthorized(request: Request) {
  const expected = process.env.TRAFFIC_REPORT_API_TOKEN;
  if (!expected || expected.length < 32) return false;
  const supplied = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!supplied) return false;
  return timingSafeEqual(
    createHash("sha256").update(supplied).digest(),
    createHash("sha256").update(expected).digest()
  );
}
