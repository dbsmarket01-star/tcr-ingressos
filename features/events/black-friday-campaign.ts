// November 2026 in America/Sao_Paulo; do not advertise this campaign in later months.
const START = Date.parse("2026-11-01T00:00:00-03:00");
const END = Date.parse("2026-12-01T00:00:00-03:00");

export function showBlackFridayRibbon(organizationSlug: string, eventStartsAt: Date, now = new Date(), eventSlug?: string) {
  const eventTime = eventStartsAt.getTime();
  const currentTime = now.getTime();
  return organizationSlug === "tcr-ingressos" &&
    eventSlug !== "geriatricus-em-santo-andre-2026" &&
    currentTime >= START && currentTime < END && eventTime >= currentTime;
}
