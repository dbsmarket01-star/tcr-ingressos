import { expect, it } from "vitest";
import { buildEventTicketSalesPdf } from "@/features/reports/event-ticket-sales-report-pdf";

it("wraps numbered boxes without losing labels and paginates every row", () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    key: String(index), ticketName: `CAMAROTE PARA 10 PESSOAS - CAMAROTE ${String(index + 1).padStart(2, "0")}`,
    ticketType: "Online" as const, unitPriceInCents: 149790, quantity: 10,
    ticketRevenueInCents: 149790, serviceFeeInCents: 0, couponDiscountInCents: 0,
    refundInCents: 0, chargebackInCents: 0, totalInCents: 149790
  }));
  const pdf = buildEventTicketSalesPdf({ event: { id: "e", slug: "evento", title: "Evento", startsAt: new Date() }, organization: { name: "TCR Ingressos" }, rows, totals: { ...rows[0], quantity: 300 } }).toString();
  expect(pdf).toContain("/Count 3");
  expect(pdf.match(/\(TOTAIS\)/g)).toHaveLength(1);
  for (let n = 1; n <= 30; n++) expect(pdf).toContain(`(CAMAROTE ${String(n).padStart(2, "0")})`);
  expect(pdf).not.toContain("(CAMAROTE PARA 10 PESSOAS - CAMAROTE");
});
