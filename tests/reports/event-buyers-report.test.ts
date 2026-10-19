import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  buyerReportCell,
  buyerReportCsvLine,
  buyerReportWhere,
  defaultBuyerReportFields,
  parseBuyerReportFilters,
  type BuyerReportTicket
} from "@/features/reports/event-buyers-report.service";

const ticket = {
  id: "ticket-1",
  code: "T-1",
  status: "ACTIVE",
  lotId: "lot-1",
  lot: { name: "ARQUIBANCADA - MEIA ENTRADA" },
  lotOption: null,
  participant: { name: "Participante A", email: "p@example.com", phone: "11999999999", document: "12345678900" },
  orderItem: { quantity: 2, admissionsPerUnit: 1 },
  order: {
    code: "ING-123",
    paidAt: new Date("2026-10-19T12:00:00.000Z"),
    customer: { name: "Compradora B", email: "b@example.com", phone: "11888888888", document: "98765432100" }
  }
} as BuyerReportTicket;

describe("event buyers report", () => {
  it("selects only recognized fields and keeps sensible defaults", () => {
    expect(parseBuyerReportFilters(new URLSearchParams()).fields).toEqual(defaultBuyerReportFields);
    expect(parseBuyerReportFilters(new URLSearchParams("fields=buyerName&fields=invalid&fields=buyerName&fields=buyerCpf")).fields)
      .toEqual(["buyerName", "buyerCpf"]);
  });

  it("limits paid tickets to the selected event and valid statuses by default", () => {
    const filters = parseBuyerReportFilters(new URLSearchParams("lotId=lot-1&search=Rafaela"));
    const where = buyerReportWhere("event-1", filters);
    expect(where).toMatchObject({
      eventId: "event-1",
      lotId: "lot-1",
      order: {
        status: "PAID",
        OR: [{ payment: null }, { payment: { status: { not: "REFUNDED" } } }]
      },
      status: { in: ["ACTIVE", "USED"] }
    });
    expect(where.OR).toHaveLength(10);
    expect(buyerReportWhere("event-1", parseBuyerReportFilters(new URLSearchParams("status=all"))).status).toBeUndefined();
  });

  it("does not confuse the buyer with the participant and shows the bought quantity", () => {
    expect(buyerReportCell(ticket, "buyerName")).toBe("Compradora B");
    expect(buyerReportCell(ticket, "participantName")).toBe("Participante A");
    expect(buyerReportCell(ticket, "buyerCpf")).toBe("98765432100");
    expect(buyerReportCell(ticket, "participantCpf")).toBe("12345678900");
    expect(buyerReportCell(ticket, "admissionQuantity")).toBe("1");
    expect(buyerReportCell(ticket, "quantityInOrder")).toBe("2");
    expect(buyerReportCell(ticket, "sector")).toBe("ARQUIBANCADA");
    expect(buyerReportCell({ ...ticket, participant: null }, "participantName")).toBe("");
  });

  it("escapes CSV cells and neutralizes spreadsheet formulas", () => {
    expect(buyerReportCsvLine(["Nome; teste", "=2+2", "+55119999", "Ana \"B\""]))
      .toBe('"Nome; teste";"\'=2+2";"\'+55119999";"Ana ""B"""\r\n');
  });
});
