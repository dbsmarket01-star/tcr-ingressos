import { describe, expect, it } from "vitest";
import { showBlackFridayRibbon } from "../../features/events/black-friday-campaign";
const now = new Date("2026-11-09T22:00:00-03:00");
describe("TCR November 2026 ribbon", () => {
  it("includes November events even when the UTC date is December", () => {
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2026-12-01T00:00:00Z"), now)).toBe(true);
  });
  it("does not advertise March events or other organizations", () => {
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2027-03-21T01:00:00Z"), now)).toBe(false);
    expect(showBlackFridayRibbon("other", new Date("2026-11-21T00:00:00Z"), now)).toBe(false);
  });
  it("excludes October and December at the Sao Paulo month boundaries", () => {
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2026-11-01T02:59:59Z"), now)).toBe(false);
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2026-11-01T03:00:00Z"), now)).toBe(true);
    expect(showBlackFridayRibbon("tcr-ingressos", new Date("2026-12-01T03:00:00Z"), now)).toBe(false);
  });
  it("stops showing the promotion after November and does not start early", () => {
    const event = new Date("2026-11-21T00:00:00Z");
    expect(showBlackFridayRibbon("tcr-ingressos", event, new Date("2026-12-01T03:00:00Z"))).toBe(false);
    expect(showBlackFridayRibbon("tcr-ingressos", event, new Date("2026-11-01T02:59:59Z"))).toBe(false);
  });
});
