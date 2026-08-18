export const MIN_PIX_PAYMENT_AMOUNT_IN_CENTS = 1000;
export const MIN_CARD_PAYMENT_AMOUNT_IN_CENTS = 500;
export const MIN_CARD_INSTALLMENT_AMOUNT_IN_CENTS = 500;
export const MIN_PAYABLE_AMOUNT_IN_CENTS = MIN_PIX_PAYMENT_AMOUNT_IN_CENTS;
export const PUBLIC_PRICE_ROUNDING_INCREMENT_IN_CENTS = 50;

export function roundPublicPriceUpInCents(valueInCents: number) {
  const safeValueInCents = Math.max(Math.round(valueInCents), 0);
  return Math.ceil(safeValueInCents / PUBLIC_PRICE_ROUNDING_INCREMENT_IN_CENTS) * PUBLIC_PRICE_ROUNDING_INCREMENT_IN_CENTS;
}

export function calculateServiceFeeInCents(priceInCents: number, quantity: number, serviceFeeBps: number) {
  return Math.round(priceInCents * quantity * (serviceFeeBps / 10000));
}

export function allocateDiscountAcrossTotals(
  subtotalInCents: number,
  serviceFeeInCents: number,
  discountInCents: number
) {
  const cappedDiscountInCents = Math.min(
    Math.max(discountInCents, 0),
    Math.max(subtotalInCents + serviceFeeInCents, 0)
  );
  const subtotalDiscountInCents = Math.min(subtotalInCents, cappedDiscountInCents);
  const serviceFeeDiscountInCents = Math.min(
    serviceFeeInCents,
    cappedDiscountInCents - subtotalDiscountInCents
  );

  return {
    netSubtotalInCents: subtotalInCents - subtotalDiscountInCents,
    netServiceFeeInCents: serviceFeeInCents - serviceFeeDiscountInCents,
    serviceFeeDiscountInCents,
    subtotalDiscountInCents
  };
}

export function capDiscountToPayableAmount(amountInCents: number, discountInCents: number) {
  if (amountInCents <= MIN_PAYABLE_AMOUNT_IN_CENTS) {
    return 0;
  }

  return Math.min(Math.max(discountInCents, 0), amountInCents - MIN_PAYABLE_AMOUNT_IN_CENTS);
}

export function calculatePixDiscountInCents(
  amountInCents: number,
  quantity: number,
  pixDiscountPercentBps: number,
  pixDiscountFixedInCents: number
) {
  const percentageDiscount =
    pixDiscountPercentBps > 0 ? Math.round(amountInCents * (pixDiscountPercentBps / 10000)) : 0;
  const fixedDiscount = pixDiscountFixedInCents > 0 ? pixDiscountFixedInCents * quantity : 0;

  return capDiscountToPayableAmount(amountInCents, percentageDiscount + fixedDiscount);
}

export function calculateCardInterestInCents(
  amountInCents: number,
  installments: number,
  bpsPerInstallment: number,
  startsAtInstallment = 2
) {
  if (installments < startsAtInstallment || bpsPerInstallment <= 0) {
    return 0;
  }

  return Math.round(amountInCents * installments * (bpsPerInstallment / 10000));
}

export function parseInstallmentStart(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 2);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 2;
  }

  return Math.min(parsed, 12);
}

export function formatPercentageFromBps(bps: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: bps % 100 === 0 ? 0 : 2
  }).format(bps / 100)}%`;
}

export function parsePercentageToBps(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").replace(",", ".").trim();
  const parsed = Number(normalized || 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

export function parseMoneyToCents(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").replace(",", ".").trim();
  const parsed = Number(normalized || 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(Math.round(parsed * 100), 0);
}
