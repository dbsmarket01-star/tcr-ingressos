const AUTOMATED_EMAIL_CHECK_PATTERNS = [
  "bot",
  "crawler",
  "spider",
  "preview",
  "scanner",
  "linkcheck",
  "link-check",
  "safe-links",
  "safelinks",
  "proofpoint",
  "barracuda",
  "mimecast",
  "curl",
  "wget",
  "python-requests",
  "facebookexternalhit",
  "slackbot",
  "discordbot",
  "twitterbot",
  "linkedinbot",
  "whatsapp"
];

export function isLikelyAutomatedEmailCheck(request: Request) {
  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  const purpose = request.headers.get("purpose")?.toLowerCase() ?? "";
  const secPurpose = request.headers.get("sec-purpose")?.toLowerCase() ?? "";
  const secFetchMode = request.headers.get("sec-fetch-mode")?.toLowerCase() ?? "";

  if (purpose.includes("prefetch") || secPurpose.includes("prefetch")) {
    return true;
  }

  if (secFetchMode === "prefetch") {
    return true;
  }

  return AUTOMATED_EMAIL_CHECK_PATTERNS.some((pattern) => userAgent.includes(pattern));
}
