import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SalesViewerDashboard } from "@/components/admin/SalesViewerDashboard";
vi.mock("@/components/admin/AdminShell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => children }));
const dashboard = {
  period: { startDate: "2026-10-01", endDate: "2026-10-10" },
  kpis: { ticketSalesInCents: 20000, paidTickets: 2, paidOrders: 1, serviceFeesInCents: 98765, cardInterestInCents: 54321 },
  salesByDay: [{ date: "2026-10-01", label: "01/10", ticketSalesInCents: 20000, paidTicketQuantity: 2, salesCount: 1 }],
  paymentMethods: { pix: { count: 1, ticketSalesInCents: 20000 }, card: { count: 0, ticketSalesInCents: 0 }, other: { count: 0, ticketSalesInCents: 0 } },
  eventSales: [{ id: "permitted", title: "Evento permitido", ticketSalesInCents: 20000, ticketQuantity: 2, paidOrders: 1 }]
} as unknown as Parameters<typeof SalesViewerDashboard>[0]["dashboard"];
describe("sales viewer dashboard", () => {
  it("shows ticket-only charts and scoped event sales, linking to the same period", () => {
    const html = renderToStaticMarkup(React.createElement(SalesViewerDashboard, { dashboard }));
    expect(html).toContain("Vendas por evento no período");
    expect(html).not.toContain("Vendas diárias no período");
    expect(html).toContain("Total no período");
    expect(html).toContain("Evento permitido");
    expect(html).toContain("Pix: 100.0%");
    expect(html).toContain("Quantidade de ingressos");
    expect(html).toContain("1 pedidos pagos, 2 ingressos");
    expect(html).toContain("Valor faturado");
    expect(html).not.toContain("Taxa bilheteria");
    expect(html).toContain("eventId=permitted&amp;startDate=2026-10-01&amp;endDate=2026-10-10");
    expect(html).not.toContain("987,65");
    expect(html).not.toContain("543,21");
  });
  it("renders an empty period without invalid graph numbers", () => {
    const empty = { ...dashboard, salesByDay: [], eventSales: [], paymentMethods: { ...dashboard.paymentMethods, pix: { ...dashboard.paymentMethods.pix, count: 0, ticketSalesInCents: 0 }, card: { ...dashboard.paymentMethods.card, count: 0, ticketSalesInCents: 0 }, other: { ...dashboard.paymentMethods.other, count: 0, ticketSalesInCents: 0 } } };
    const html = renderToStaticMarkup(React.createElement(SalesViewerDashboard, { dashboard: empty }));
    expect(html).toContain("Nenhuma venda no período selecionado");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
});
