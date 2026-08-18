import { describe, expect, it } from "vitest";
import { roundPublicPriceUpInCents } from "@/features/pricing/pricing";

describe("public price rounding", () => {
  it.each([
    [11703, 11750],
    [11720, 11750],
    [11750, 11750],
    [11770, 11800],
    [11799, 11800]
  ])("rounds %i cents upward to %i cents", (input, expected) => {
    expect(roundPublicPriceUpInCents(input)).toBe(expected);
  });

  it("never returns a negative public price", () => {
    expect(roundPublicPriceUpInCents(-1)).toBe(0);
  });
});
