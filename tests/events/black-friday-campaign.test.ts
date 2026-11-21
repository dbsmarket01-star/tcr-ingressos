import { describe, expect, it } from "vitest";
import { showBlackFridayRibbon } from "../../features/events/black-friday-campaign";
const now = new Date("2026-11-09T22:00:00-03:00");
describe("TCR November 2026 ribbon", () => {
  it("hides the ended Geriatricus Santo Andre promotion without affecting other events", () => {
    const futureEvent = new Date("2026-11-30T23:00:00Z");
    expect(showBlackFridayRibbon("tcr-ingressos", futureEvent, now, "geriatricus-em-santo-andre-2026")).toBe(false);
    expect(showBlackFridayRibbon("tcr-ingressos", futureEvent, now, "geriatricus-em-suzano-2026")).toBe(true);
  });
  it("hides Black November only for Tunel do Tempo 2027", () => {
    const event = new Date("2027-04-11T00:00:00Z");
    expect(showBlackFridayRibbon("tcr-ingressos", event, now, "tunel-do-tempo-em-santo-andre-2027")).toBe(false);
    expect(showBlackFridayRibbon("tcr-ingressos", event, now, "another-future-event")).toBe(true);
  });
  it("includes November events even when the UTC date is December", () => {
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2026-12-01T00:00:00Z"), now)).toBe(true);
  });
  it("limits the promotion to events in November 2026", () => {
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2027-03-21T01:00:00Z"), now)).toBe(false);
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2026-12-01T03:00:00Z"), now)).toBe(false);
    expect(showBlackFridayRibbon("other", new Date("2026-11-21T00:00:00Z"), now)).toBe(false);
  });
  it("excludes past events and stops at the Sao Paulo campaign boundary", () => {
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2026-11-01T02:59:59Z"), now)).toBe(false);
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2026-11-09T20:00:00-03:00"), now)).toBe(false);
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2026-12-01T00:00:00Z"), now)).toBe(true);
  });
  it("stops showing the promotion after November and does not start early", () => {
    const event = new Date("2026-11-21T00:00:00Z");
    expect(showBlackFridayRibbon("tcr-ingressos", event, new Date("2026-12-01T03:00:00Z"))).toBe(false);
    expect(showBlackFridayRibbon("tcr-ingressos", event, new Date("2026-11-01T02:59:59Z"))).toBe(false);
  });
});
