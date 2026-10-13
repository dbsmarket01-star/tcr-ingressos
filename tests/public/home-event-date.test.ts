import { describe, expect, it } from "vitest";
import { formatEventDate } from "@/components/public/HomeEventCarousel";

describe("home event date", () => {
  it("uses the event's Brazil time instead of the server or visitor time zone", () => {
    expect(formatEventDate("2026-11-08T01:00:00.000Z")).toBe("07 NOV • SÁB 22H");
    expect(formatEventDate(new Date("2026-11-21T00:00:00.000Z"))).toBe("20 NOV • SEX 21H");
  });
});
