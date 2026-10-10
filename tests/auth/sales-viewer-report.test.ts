import { describe, expect, it, vi } from "vitest";
import { buildFinanceEventsPdf } from "@/app/admin/finance/export/pdf/route";
vi.mock("@/features/auth/auth.service", () => ({}));
vi.mock("@/features/finance/finance-report.service", () => ({}));
const report = {
  filters: { startDate: "2026-10-01", endDate: "2026-10-10" }, events: [], lots: [],
  totals: { paidOrders: 1, ticketsIssued: 2, ticketNetInCents: 20000, serviceFeeInCents: 98765, cardInterestInCents: 54321 },
  byMethod: [{ method: "PIX", count: 1 }],
  byEvent: [{ title: "Evento autorizado", venueName: "Local", city: "Cidade", state: "SP", tickets: 2, ticketNetInCents: 20000, serviceFeeInCents: 98765, cardInterestInCents: 54321 }]
} as unknown as Parameters<typeof buildFinanceEventsPdf>[0];
describe("restricted sales PDF", () => {
  it("excludes fees and interest amounts from the generated document", () => {
    const pdf = buildFinanceEventsPdf(report, true).toString();
    expect(pdf).toContain("200,00");
    expect(pdf).toContain("Evento autorizado");
    expect(pdf).not.toContain("987,65");
    expect(pdf).not.toContain("543,21");
    expect(pdf).not.toContain("Taxa da bilheteria");
    expect(pdf).not.toContain("Juros");
  });
  it("retains the full financial report for authorized roles", () => {
    const pdf = buildFinanceEventsPdf(report).toString();
    expect(pdf).toContain("987,65");
    expect(pdf).toContain("543,21");
    expect(pdf).toContain("Taxa da bilheteria");
  });
});
