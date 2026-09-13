import { describe, expect, it } from "vitest";
import { calculateCardInterestInCents } from "@/features/pricing/pricing";

describe("TCR card interest progression", () => {
  it.each([
    [1, 400],
    [2, 800],
    [3, 1200]
  ])("charges 4%% per installment at %ix", (installments, expectedInterestInCents) => {
    expect(calculateCardInterestInCents(10_000, installments, 400, 1)).toBe(expectedInterestInCents);
  });
});
