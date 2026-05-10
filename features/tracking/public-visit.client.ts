"use client";

const VISITOR_COOKIE_NAME = "ingresaas_public_visitor";
const LEGACY_VISITOR_COOKIE_NAME = "tcr_public_visitor";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return "";
  }

  const pattern = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return pattern ? decodeURIComponent(pattern[1]) : "";
}

function writeVisitorCookie(name: string, value: string, maxAge = VISITOR_COOKIE_MAX_AGE) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function createSessionKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreatePublicVisitorKey() {
  const existing = readCookie(VISITOR_COOKIE_NAME);

  if (existing) {
    return existing;
  }

  const legacy = readCookie(LEGACY_VISITOR_COOKIE_NAME);

  if (legacy) {
    writeVisitorCookie(VISITOR_COOKIE_NAME, legacy);
    writeVisitorCookie(LEGACY_VISITOR_COOKIE_NAME, "", 0);
    return legacy;
  }

  const nextKey = createSessionKey();
  writeVisitorCookie(VISITOR_COOKIE_NAME, nextKey);
  return nextKey;
}

export function sendPublicPageVisit(input: {
  eventId: string;
  pageType: "LEAD_CAPTURE" | "PUBLIC_EVENT";
}) {
  if (typeof window === "undefined") {
    return;
  }

  const sessionKey = getOrCreatePublicVisitorKey();
  const payload = JSON.stringify({
    eventId: input.eventId,
    sessionKey,
    pageType: input.pageType
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/public/track", new Blob([payload], { type: "application/json" }));
    return;
  }

  void fetch("/api/public/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: payload,
    keepalive: true
  });
}
