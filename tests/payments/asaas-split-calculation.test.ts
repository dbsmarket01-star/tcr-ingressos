import { SplitRuleType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateAsaasSplitsForOrder } from "@/features/payments/asaas-split.service";

const rules = [
  { walletId: "diego", type: SplitRuleType.PERCENTAGE, percentageBps: 800, fixedValueInCents: null },
  { walletId: "pietro", type: SplitRuleType.PERCENTAGE, percentageBps: 800, fixedValueInCents: null },
  { walletId: "lucas", type: SplitRuleType.FIXED_PER_TICKET, percentageBps: null, fixedValueInCents: 150 }
];

describe("Asaas split calculation", () => {
  it("turns ticket percentages into fixed values outside the total charge", () => {
    expect(calculateAsaasSplitsForOrder([{ quantity: 1, totalInCents: 10000 }], rules)).toEqual([
      { walletId: "diego", fixedValue: 8 },
      { walletId: "pietro", fixedValue: 8 },
      { walletId: "lucas", fixedValue: 1.5 }
    ]);
  });

  it("applies discounts only to percentage splits and keeps Lucas per ticket", () => {
    expect(calculateAsaasSplitsForOrder([{ quantity: 1, totalInCents: 10000 }], rules, { discountInCents: 2000 })).toEqual([
      { walletId: "diego", fixedValue: 6.4 },
      { walletId: "pietro", fixedValue: 6.4 },
      { walletId: "lucas", fixedValue: 1.5 }
    ]);
  });

  it("uses totalFixedValue for an installment charge", () => {
    expect(calculateAsaasSplitsForOrder([{ quantity: 2, totalInCents: 20000 }], rules, { installments: 3 })).toEqual([
      { walletId: "diego", totalFixedValue: 16 },
      { walletId: "pietro", totalFixedValue: 16 },
      { walletId: "lucas", totalFixedValue: 3 }
    ]);
  });
});
