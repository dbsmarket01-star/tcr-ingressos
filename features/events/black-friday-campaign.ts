// November 2026 in America/Sao_Paulo; do not advertise this campaign in later months.
const START = Date.parse("2026-11-01T00:00:00-03:00");
const END = Date.parse("2026-12-01T00:00:00-03:00");

export function showBlackFridayRibbon(organizationSlug: string, eventStartsAt: Date, now = new Date()) {
  const eventTime = eventStartsAt.getTime();
  const currentTime = now.getTime();
  return organizationSlug === "tcr-ingressos" &&
    eventTime >= START && eventTime < END && currentTime >= START && currentTime < END;
}
