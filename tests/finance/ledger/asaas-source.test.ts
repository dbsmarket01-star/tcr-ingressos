import { describe, it, expect, vi } from "vitest";
vi.mock("@/features/payments/payment-organization-config", () => ({
  getAsaasConfigForOrganization: () => ({
    apiUrl: "https://api.asaas.com/v3",
    accessToken: "test-token",
  }),
}));
import { fetchAsaasFinancialSnapshot } from "@/features/finance/ledger/asaas-source";
const input = {
  accountId: "wallet",
  startDate: "2026-09-01",
  endDate: "2026-09-24",
};
function mockFetch(wallet = "wallet", count = 1, balance: number | null = 100) {
  return vi.fn(async (url: any, options: any) => {
    const path = new URL(url).pathname;
    const body = path.endsWith("wallets")
      ? { data: [{ id: wallet }] }
      : path.endsWith("payments")
        ? {
            hasMore: false,
            totalCount: count,
            data: [
              {
                id: "p",
                status: "RECEIVED",
                clientPaymentDate: "2026-09-24",
                creditDate: "2026-09-24",
                externalReference: "A",
                value: 100,
                netValue: 100,
              },
            ],
          }
        : {
            hasMore: false,
            totalCount: 1,
            data: [
              {
                id: "t",
                type: "PAYMENT_RECEIVED",
                value: 100,
                date: "2026-09-24",
                balance,
                paymentId: "p",
              },
            ],
          };
    return new Response(JSON.stringify(body), { status: 200 });
  });
}
describe("read-only Asaas evidence", () => {
  it("checks account identity and only executes GETs", async () => {
    const fetcher = mockFetch();
    const result = await fetchAsaasFinancialSnapshot({} as any, input, fetcher);
    expect(result.closingBalanceInCents).toBe(10000);
    expect(result.charges[0].grossInCents).toBe(10000);
    expect(
      fetcher.mock.calls.every(([, options]) => options.method === "GET"),
    ).toBe(true);
    const statement = new URL(fetcher.mock.calls[2][0]);
    expect(statement.searchParams.get("finishDate")).toBe(input.endDate);
  });
  it("rejects the wrong wallet before querying account movements", async () => {
    const fetcher = mockFetch("other");
    await expect(
      fetchAsaasFinancialSnapshot({} as any, input, fetcher),
    ).rejects.toThrow("ASAAS_ACCOUNT_MISMATCH");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects incomplete pagination", async () => {
    await expect(
      fetchAsaasFinancialSnapshot({} as any, input, mockFetch("wallet", 2)),
    ).rejects.toThrow("ASAAS_PAGE_COUNT_MISMATCH");
  });
  it("never substitutes current cash for a missing historical balance", async () => {
    const result = await fetchAsaasFinancialSnapshot(
      {} as any,
      input,
      mockFetch("wallet", 1, null),
    );
    expect(result.closingBalanceInCents).toBeNull();
  });
});
