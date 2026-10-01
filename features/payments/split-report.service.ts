function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function extractPaymentPayload(rawPayload: unknown) {
  const root = asRecord(rawPayload);
  const nestedPayment = asRecord(root?.payment);
  return nestedPayment ?? root;
}

function maskWalletId(walletId: string) {
  if (walletId.length <= 12) {
    return walletId;
  }

  return `${walletId.slice(0, 4)}...${walletId.slice(-4)}`;
}

function numberToCents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100);
}

function extractInstallmentCount(payload: Record<string, unknown> | null) {
  const description = typeof payload?.description === "string" ? payload.description : "";
  const match = description.match(/parcela\s+\d+\s+de\s+(\d+)/i);
  const parsed = match ? Number(match[1]) : 1;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function summarizeAsaasPaymentAmounts(rawPayload: unknown) {
  const payload = extractPaymentPayload(rawPayload);
  const installmentCount = extractInstallmentCount(payload);
  const grossPerInstallmentInCents = numberToCents(payload?.value);
  const netPerInstallmentInCents = numberToCents(payload?.netValue);

  if (grossPerInstallmentInCents <= 0 || netPerInstallmentInCents <= 0) {
    return { installmentCount, grossInCents: 0, netInCents: 0, feeInCents: 0 };
  }

  return {
    installmentCount,
    grossInCents: grossPerInstallmentInCents * installmentCount,
    netInCents: netPerInstallmentInCents * installmentCount,
    feeInCents: Math.max(grossPerInstallmentInCents - netPerInstallmentInCents, 0) * installmentCount
  };
}

export function extractAsaasSplitEntries(rawPayload: unknown) {
  const payload = extractPaymentPayload(rawPayload);
  const split = Array.isArray(payload?.split) ? payload.split : [];

  return split
    .map((entry) => {
      const row = asRecord(entry);
      const walletId = typeof row?.walletId === "string" ? row.walletId : "";
      const status = typeof row?.status === "string" ? row.status : "UNKNOWN";
      const totalInCents = numberToCents(row?.totalValue ?? row?.fixedValue);

      if (!walletId || totalInCents <= 0) {
        return null;
      }

      return {
        walletId,
        walletLabel: maskWalletId(walletId),
        status,
        totalInCents
      };
    })
    .filter((entry): entry is { walletId: string; walletLabel: string; status: string; totalInCents: number } =>
      Boolean(entry)
    );
}

export function summarizeAsaasSplit(rawPayload: unknown) {
  const payload = extractPaymentPayload(rawPayload);
  const installmentCount = extractInstallmentCount(payload);
  const entries = extractAsaasSplitEntries(rawPayload).map((entry) => ({
    ...entry,
    totalInCents: entry.totalInCents * installmentCount
  }));

  return {
    entries,
    totalInCents: entries.reduce((sum, entry) => sum + entry.totalInCents, 0)
  };
}
