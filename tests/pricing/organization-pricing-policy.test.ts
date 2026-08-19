import { describe, expect, it } from "vitest";
import {
  finalizeOrganizationPublicPriceInCents,
  getEffectiveFixedOrderFeeInCents,
  getEffectivePaymentFeeSettings,
  getEffectiveServiceFeeBps,
  isFeeFreeOrganization
} from "@/features/pricing/organization-pricing-policy";

describe("organization pricing policy", () => {
  it("keeps A2 Imergidos completely fee free", () => {
    expect(isFeeFreeOrganization("a2-imergidos")).toBe(true);
    expect(getEffectiveServiceFeeBps("a2-imergidos", 1750)).toBe(0);
    expect(getEffectiveFixedOrderFeeInCents("a2-imergidos", 200)).toBe(0);
    expect(finalizeOrganizationPublicPriceInCents("a2-imergidos", 97_90)).toBe(97_90);
    expect(getEffectivePaymentFeeSettings("a2-imergidos", {
      pixTransactionFeeInCents: 200,
      cardBaseFeeBps: 400,
      cardAdditionalInstallmentFeeBps: 300
    })).toEqual({
      pixTransactionFeeInCents: 0,
      cardBaseFeeBps: 0,
      cardAdditionalInstallmentFeeBps: 0
    });
  });

  it("preserves TCR pricing and rounding", () => {
    expect(isFeeFreeOrganization("tcr-ingressos")).toBe(false);
    expect(getEffectiveServiceFeeBps("tcr-ingressos", 1750)).toBe(1750);
    expect(getEffectiveFixedOrderFeeInCents("tcr-ingressos", 200)).toBe(200);
    expect(finalizeOrganizationPublicPriceInCents("tcr-ingressos", 117_03)).toBe(117_90);
  });
});
