import type { SplitRuleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AsaasSplit } from "./payment-provider";

type OrderItemForSplit = {
  quantity: number;
};

function moneyFromCents(valueInCents: number) {
  return Number((valueInCents / 100).toFixed(2));
}

function percentageFromBps(valueInBps: number) {
  return Number((valueInBps / 100).toFixed(2));
}

function fixedValueForRule(type: SplitRuleType, fixedValueInCents: number | null, ticketQuantity: number) {
  if (!fixedValueInCents) {
    return undefined;
  }

  if (type === "FIXED_PER_TICKET") {
    return moneyFromCents(fixedValueInCents * ticketQuantity);
  }

  if (type === "FIXED_PER_ORDER") {
    return moneyFromCents(fixedValueInCents);
  }

  return undefined;
}

export async function buildAsaasSplitsForOrder(items: OrderItemForSplit[]): Promise<AsaasSplit[] | undefined> {
  const ticketQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const rules = await prisma.paymentSplitRule.findMany({
    where: {
      isActive: true
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  const splits = rules
    .map((rule) => {
      const fixedValue = fixedValueForRule(rule.type, rule.fixedValueInCents, ticketQuantity);
      const percentualValue = rule.type === "PERCENTAGE" && rule.percentageBps ? percentageFromBps(rule.percentageBps) : undefined;

      if (fixedValue === undefined && percentualValue === undefined) {
        return null;
      }

      return {
        walletId: rule.walletId,
        ...(fixedValue !== undefined ? { fixedValue } : {}),
        ...(percentualValue !== undefined ? { percentualValue } : {})
      };
    })
    .filter((split): split is AsaasSplit => Boolean(split));

  return splits.length > 0 ? splits : undefined;
}
