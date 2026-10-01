import { describe, expect, it } from "vitest";
import { summarizeAsaasPaymentAmounts, summarizeAsaasSplit } from "@/features/payments/split-report.service";

describe("Asaas split report", () => {
  const installmentPayload = {
    value: 115.57,
    netValue: 112.15,
    description: "Parcela 1 de 3. Pedido ING-TESTE",
    split: [
      { walletId: "diego", status: "PENDING", totalValue: 7.97 },
      { walletId: "lucas", status: "PENDING", totalValue: 1 }
    ]
  };

  it("expands provider amounts across all installments", () => {
    expect(summarizeAsaasPaymentAmounts(installmentPayload)).toEqual({
      installmentCount: 3,
      grossInCents: 34671,
      netInCents: 33645,
      feeInCents: 1026
    });
  });

  it("expands split entries across all installments", () => {
    expect(summarizeAsaasSplit(installmentPayload)).toEqual({
      entries: [
        { walletId: "diego", walletLabel: "diego", status: "PENDING", totalInCents: 2391 },
        { walletId: "lucas", walletLabel: "lucas", status: "PENDING", totalInCents: 300 }
      ],
      totalInCents: 2691
    });
  });
});
