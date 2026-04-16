export function calculateServiceFeeInCents(priceInCents: number, quantity: number, serviceFeeBps: number) {
  return Math.round(priceInCents * quantity * (serviceFeeBps / 10000));
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
