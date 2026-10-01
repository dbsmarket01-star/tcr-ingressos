import {
  getAsaasConfigForOrganization,
  type PaymentOrganizationContext,
} from "@/features/payments/payment-organization-config";
import { money, snapshotNever } from "./source-utils";
import { snapshotSchema, type FinancialSnapshot } from "./reconciliation";

type Row = Record<string, unknown>;
const record = (x: unknown): Row =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Row) : {};
const date = (x: unknown) =>
  typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : null;
const idOf = (x: unknown) =>
  typeof x === "string"
    ? x
    : typeof record(x).id === "string"
      ? (record(x).id as string)
      : null;

function assertAsaasBase(apiUrl: string) {
  const base = new URL(apiUrl);
  if (
    base.protocol !== "https:" ||
    !["api.asaas.com", "api-sandbox.asaas.com"].includes(base.hostname) ||
    base.pathname.replace(/\/$/, "") !== "/v3"
  )
    throw new Error("ASAAS_RECONCILIATION_URL_INVALID");
  return base;
}

async function asaasGet(
  organization: PaymentOrganizationContext,
  path: string,
  params: Record<string, string> = {},
  fetcher: typeof fetch = fetch,
) {
  const config = getAsaasConfigForOrganization(organization);
  if (!config.accessToken)
    throw new Error("ASAAS_RECONCILIATION_CREDENTIAL_MISSING");
  assertAsaasBase(config.apiUrl);
  const url = new URL(`${config.apiUrl}/${path}`);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  const response = await fetcher(url, {
    method: "GET",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      access_token: config.accessToken,
      "User-Agent": "IngresaasLedger/1.0",
    },
  });
  if (!response.ok) throw new Error(`ASAAS_READ_FAILED:${response.status}`);
  return record(await response.json());
}

export async function discoverAsaasWalletId(
  organization: PaymentOrganizationContext,
  fetcher: typeof fetch = fetch,
) {
  const wallets = await asaasGet(organization, "wallets", {}, fetcher);
  const ids = (Array.isArray(wallets.data) ? wallets.data : [wallets])
    .map((value) => idOf(value))
    .filter((value): value is string => Boolean(value));
  if (ids.length !== 1) throw new Error("ASAAS_WALLET_ID_AMBIGUOUS");
  return ids[0];
}

/** Only GET is exposed. This adapter cannot execute a payout/refund or create a charge. */
export async function fetchAsaasFinancialSnapshot(
  organization: PaymentOrganizationContext,
  input: { accountId: string; startDate: string; endDate: string },
  fetcher: typeof fetch = fetch,
): Promise<FinancialSnapshot> {
  const config = getAsaasConfigForOrganization(organization);
  if (!config.accessToken)
    throw new Error("ASAAS_RECONCILIATION_CREDENTIAL_MISSING");
  assertAsaasBase(config.apiUrl);
  const get = async (path: string, params: Record<string, string> = {}) => {
    return asaasGet(organization, path, params, fetcher);
  };
  const wallets = await get("wallets");
  const walletIds = Array.isArray(wallets.data)
    ? wallets.data.map((x) => idOf(x))
    : [idOf(wallets)];
  if (!walletIds.includes(input.accountId))
    throw new Error("ASAAS_ACCOUNT_MISMATCH");
  const list = async (path: string, params: Record<string, string>) => {
    const rows: Row[] = [];
    const ids = new Set<string>();
    let expectedCount: number | null = null;
    for (let offset = 0; offset < 50000; offset += 100) {
      const page = await get(path, {
        ...params,
        offset: String(offset),
        limit: "100",
      });
      if (
        !Array.isArray(page.data) ||
        typeof page.hasMore !== "boolean" ||
        typeof page.totalCount !== "number"
      )
        throw new Error("ASAAS_INCOMPLETE_PAGE");
      if (expectedCount !== null && expectedCount !== page.totalCount)
        throw new Error("ASAAS_SOURCE_CHANGED_DURING_PAGINATION");
      expectedCount = page.totalCount;
      for (const value of page.data) {
        const row = record(value);
        const id = idOf(row);
        if (!id || ids.has(id)) throw new Error("ASAAS_DUPLICATE_SOURCE_ID");
        ids.add(id);
        rows.push(row);
      }
      if (!page.hasMore) {
        if (rows.length !== expectedCount)
          throw new Error("ASAAS_PAGE_COUNT_MISMATCH");
        return rows;
      }
      if (page.data.length !== 100) throw new Error("ASAAS_INCOMPLETE_PAGE");
    }
    throw new Error("ASAAS_PAGINATION_LIMIT");
  };
  // Full charge catalog is necessary to detect paid charges that have no TCR order.
  const charges = await list("payments", {});
  const transactions = await list("financialTransactions", {
    startDate: input.startDate,
    finishDate: input.endDate,
    order: "asc",
  });
  const issues: string[] = [];
  const normalized = charges.map((c) => {
    const status = String(c.status);
    const paidDate =
      date(c.clientPaymentDate) ?? date(c.paymentDate) ?? date(c.confirmedDate);
    const creditDate = date(c.creditDate);
    if (
      [
        "RECEIVED",
        "CONFIRMED",
        "REFUNDED",
        "REFUND_REQUESTED",
        "CHARGEBACK_REQUESTED",
        "CHARGEBACK_DISPUTE",
      ].includes(status) &&
      !paidDate
    )
      issues.push(`PAYMENT_DATE_MISSING:${c.id}`);
    if (status === "RECEIVED" && !creditDate)
      issues.push(`CREDIT_DATE_MISSING:${c.id}`);
    if (status.includes("CHARGEBACK") || status === "REFUND_REQUESTED")
      issues.push(`PAYMENT_REQUIRES_REVIEW:${c.id}`);
    const refunds = Array.isArray(c.refunds)
      ? c.refunds
          .map(record)
          .filter((r) => r.status === "DONE")
          .map((r, i) => ({
            id: idOf(r) ?? `${c.id}:refund:${i}`,
            amountInCents: money(r.value),
            date: date(r.dateCreated),
          }))
      : [];
    if (status === "REFUNDED" && !refunds.length)
      issues.push(`REFUND_DETAILS_MISSING:${c.id}`);
    return {
      id: String(c.id),
      orderCode:
        typeof c.externalReference === "string" ? c.externalReference : null,
      status,
      paidDate,
      creditDate,
      grossInCents: money(c.value),
      netInCents: money(c.netValue),
      refunds,
    };
  });
  const last = transactions.at(-1);
  // The current /finance/balance is NOT a historical closing balance. If the statement
  // lacks its balance field, the close stays BLOCKED rather than substituting today's cash.
  const closingBalanceInCents =
    last?.balance != null ? money(last.balance) : null;
  return snapshotSchema.parse({
    ...input,
    capturedAt: new Date().toISOString(),
    complete: true,
    closingBalanceInCents,
    issues,
    charges: normalized,
    transactions: transactions.map((t) => ({
      id: String(t.id),
      type: String(t.type),
      amountInCents: money(t.value),
      date: date(t.date) ?? snapshotNever("TRANSACTION_DATE_MISSING"),
      paymentId: idOf(t.paymentId) ?? idOf(t.payment),
      splitId: idOf(t.paymentSplitId) ?? idOf(t.splitId),
    })),
  });
}
