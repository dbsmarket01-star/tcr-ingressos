import { describe, expect, it } from "vitest";
import {
  calculateCardChargeInCents,
  calculatePixChargeInCents,
  getCardProcessorFeeBps
} from "@/features/payments/payment-fee-calculator";

const settings = {
  pixTransactionFeeInCents: 200,
  cardBaseFeeBps: 400,
  cardAdditionalInstallmentFeeBps: 300
};

describe("payment fee calculator", () => {
  it("adds the fixed Asaas Pix cost without reducing tickets or splits", () => {
    expect(calculatePixChargeInCents(10000, 1750, settings)).toBe(11950);
  });

  it.each([
    [1, 400],
    [2, 700],
    [3, 1000],
    [4, 1300]
  ])("uses the agreed card progression at %ix", (installments, expectedBps) => {
    expect(getCardProcessorFeeBps(installments, settings)).toBe(expectedBps);
  });

  it("grosses up the card charge so the net amount preserves tickets and splits", () => {
    expect(calculateCardChargeInCents(10000, 1750, 1, settings)).toBe(12240);
    expect(calculateCardChargeInCents(8000, 1430, 1, settings)).toBe(9823);
  });

  it("does not charge card interest in 1x for TCR and adds 4% per installment starting at 2x", () => {
    const tcrSettings = {
      ...settings,
      cardBaseFeeBps: 400,
      cardAdditionalInstallmentFeeBps: 400,
      cardFirstInstallmentInterestFree: true
    };
    expect(getCardProcessorFeeBps(1, tcrSettings)).toBe(0);
    expect(getCardProcessorFeeBps(2, tcrSettings)).toBe(400);
    expect(getCardProcessorFeeBps(3, tcrSettings)).toBe(800);
    expect(getCardProcessorFeeBps(4, tcrSettings)).toBe(1200);
    expect(getCardProcessorFeeBps(10, tcrSettings)).toBe(3600);
    expect(calculateCardChargeInCents(10000, 1750, 1, tcrSettings)).toBe(11750);
    expect(calculateCardChargeInCents(10000, 1750, 2, tcrSettings)).toBe(12240);
  });
});
