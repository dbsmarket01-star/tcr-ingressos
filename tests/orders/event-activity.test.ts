import { describe, expect, it } from "vitest";
import { activeOrderEventWhere, orderEventActivityWhere } from "@/features/orders/event-activity";

describe("order event activity", () => {
  const now = new Date("2026-10-21T01:00:00Z"); // Still October 20 in Brasília.
  it("includes today's published events and ongoing events, with Brasília dates", () => {
    expect(activeOrderEventWhere(now)).toEqual({ status: "PUBLISHED", OR: [
      { endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: new Date("2026-10-20T03:00:00Z") } }
    ] });
  });
  it("makes inactive the complement and leaves all unfiltered", () => {
    expect(orderEventActivityWhere("inactive", now)).toEqual({ NOT: activeOrderEventWhere(now) });
    expect(orderEventActivityWhere("active", now)).toEqual(activeOrderEventWhere(now));
    expect(orderEventActivityWhere()).toEqual({});
    expect(orderEventActivityWhere("invalid")).toEqual({});
  });
});
