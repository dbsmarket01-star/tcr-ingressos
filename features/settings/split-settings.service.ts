import { SplitRuleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SplitRuleFormInput } from "./split-settings.schema";

const PREVIEW_ORDER_AMOUNT_IN_CENTS = 50000;
const PREVIEW_TICKET_QUANTITY = 5;

export async function listPaymentSplitRules() {
  return prisma.paymentSplitRule.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
}

export async function replacePaymentSplitRules(rules: SplitRuleFormInput[]) {
  const cleanRules = rules
    .filter((rule) => rule.walletId && rule.value > 0)
    .map((rule, index) => ({
      name: rule.name || `Socio ${index + 1}`,
      walletId: rule.walletId || "",
      type: rule.type as SplitRuleType,
      percentageBps: rule.type === "PERCENTAGE" ? Math.round(rule.value * 100) : null,
      fixedValueInCents: rule.type !== "PERCENTAGE" ? Math.round(rule.value * 100) : null,
      isActive: rule.isActive,
      sortOrder: index
    }));

  return prisma.$transaction(async (tx) => {
    await tx.paymentSplitRule.deleteMany();

    if (cleanRules.length === 0) {
      return [];
    }

    await tx.paymentSplitRule.createMany({
      data: cleanRules
    });

    return tx.paymentSplitRule.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  });
}

function previewAmountForRule(rule: Awaited<ReturnType<typeof listPaymentSplitRules>>[number]) {
  if (!rule.isActive) {
    return 0;
  }

  if (rule.type === "PERCENTAGE") {
    return Math.round((PREVIEW_ORDER_AMOUNT_IN_CENTS * (rule.percentageBps ?? 0)) / 10000);
  }

  if (rule.type === "FIXED_PER_TICKET") {
    return (rule.fixedValueInCents ?? 0) * PREVIEW_TICKET_QUANTITY;
  }

  return rule.fixedValueInCents ?? 0;
}

export function buildSplitRulesPreview(rules: Awaited<ReturnType<typeof listPaymentSplitRules>>) {
  const rows = rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    walletId: rule.walletId,
    type: rule.type,
    isActive: rule.isActive,
    estimatedAmountInCents: previewAmountForRule(rule)
  }));
  const totalInCents = rows.reduce((sum, row) => sum + row.estimatedAmountInCents, 0);

  return {
    orderAmountInCents: PREVIEW_ORDER_AMOUNT_IN_CENTS,
    ticketQuantity: PREVIEW_TICKET_QUANTITY,
    totalInCents,
    remainingInCents: PREVIEW_ORDER_AMOUNT_IN_CENTS - totalInCents,
    rows
  };
}
