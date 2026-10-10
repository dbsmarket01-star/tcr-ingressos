import { expect, it } from "vitest";
import { chartDayAtTouch } from "@/lib/chart-touch";

it("selects the same first, middle and last plotted days at different mobile widths", () => {
  for (const width of [260, 340, 708]) {
    const left = 24;
    expect(chartDayAtTouch(left + width * 26 / 640, left, width, 7)).toBe(0);
    expect(chartDayAtTouch(left + width * 324 / 640, left, width, 7)).toBe(3);
    expect(chartDayAtTouch(left + width * 622 / 640, left, width, 7)).toBe(6);
    expect(chartDayAtTouch(-100, left, width, 7)).toBe(0);
    expect(chartDayAtTouch(2000, left, width, 7)).toBe(6);
  }
});
it("handles a single day and empty or not yet measured charts", () => {
  expect(chartDayAtTouch(100, 0, 300, 1)).toBe(0);
  expect(chartDayAtTouch(100, 0, 300, 0)).toBeNull();
  expect(chartDayAtTouch(100, 0, 0, 7)).toBeNull();
});
