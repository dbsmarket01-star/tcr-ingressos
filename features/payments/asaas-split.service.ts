import type { SplitRuleType } from "@prisma/client";
import { getDefaultOrganizationId } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";
import type { AsaasSplit } from "./payment-provider";

type OrderItemForSplit = {
  quantity: number;
  totalInCents: number;
};

function moneyFromCents(valueInCents: number) {
  return Number((valueInCents / 100).toFixed(2));
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

export async function buildAsaasSplitsForOrder(
  items: OrderItemForSplit[],
  organizationId?: string | null,
  options?: { discountInCents?: number; installments?: number }
): Promise<AsaasSplit[] | undefined> {
  const resolvedOrganizationId = organizationId || (await getDefaultOrganizationId());
  const rules = await prisma.paymentSplitRule.findMany({
    where: {
      organizationId: resolvedOrganizationId,
      isActive: true
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return calculateAsaasSplitsForOrder(items, rules, options);
}

export function calculateAsaasSplitsForOrder(
  items: OrderItemForSplit[],
  rules: Array<{
    walletId: string;
    type: SplitRuleType;
    percentageBps: number | null;
    fixedValueInCents: number | null;
  }>,
  options?: { discountInCents?: number; installments?: number }
) {
  const ticketQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const ticketSubtotalInCents = items.reduce((sum, item) => sum + item.totalInCents, 0);
  const netTicketAmountInCents = Math.max(ticketSubtotalInCents - Math.max(options?.discountInCents ?? 0, 0), 0);
  const splits = rules
    .map((rule): AsaasSplit | null => {
      const fixedValue = fixedValueForRule(rule.type, rule.fixedValueInCents, ticketQuantity);
      const percentageFixedValueInCents =
        rule.type === "PERCENTAGE" && rule.percentageBps
          ? Math.round(netTicketAmountInCents * (rule.percentageBps / 10000))
          : undefined;
      const fixedValueInCents = fixedValue === undefined ? percentageFixedValueInCents : Math.round(fixedValue * 100);

      if (fixedValueInCents === undefined || fixedValueInCents <= 0) {
        return null;
      }

      return {
        walletId: rule.walletId,
        ...(options?.installments && options.installments > 1
          ? { totalFixedValue: moneyFromCents(fixedValueInCents) }
          : { fixedValue: moneyFromCents(fixedValueInCents) })
      };
    })
    .filter((split): split is AsaasSplit => Boolean(split));

  return splits.length > 0 ? splits : undefined;
}

export function sumAsaasSplitsInCents(splits?: AsaasSplit[]) {
  return (splits ?? []).reduce(
    (sum, split) => sum + Math.round((split.totalFixedValue ?? split.fixedValue ?? 0) * 100),
    0
  );
}
