import { describe, expect, it } from "vitest";
import { roundPublicPriceUpInCents } from "@/features/pricing/pricing";

describe("public price rounding", () => {
  it.each([
    [11703, 11790],
    [11750, 11790],
    [11790, 11890],
    [11791, 11890],
    [22253, 22390],
    [22300, 22390],
    [22399, 22490]
  ])("rounds %i cents upward to a price ending in 90 cents: %i", (input, expected) => {
    expect(roundPublicPriceUpInCents(input)).toBe(expected);
  });

  it("never returns a negative public price", () => {
    expect(roundPublicPriceUpInCents(-1)).toBe(0);
  });
});
