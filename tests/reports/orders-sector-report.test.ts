import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ event: { findMany: vi.fn(), findFirst: vi.fn() }, orderItem: { findMany: vi.fn().mockResolvedValue([]) }, ticket: { groupBy: vi.fn() }, seat: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/features/orders/order.service", () => ({ expirePendingOrders: vi.fn() }));
import { getOrdersSectorReport } from "@/features/reports/orders-sector-report.service";
import { buildReportOrderWhere } from "@/features/orders/order.admin.service";
import { buildEventSectorPdf } from "@/features/reports/event-sector-report-pdf";

describe("orders sector report", () => {
  beforeEach(() => vi.clearAllMocks());
  it("preserves paid-date timezone boundaries, lot and organization/event permissions", async () => {
    const where = await buildReportOrderWhere({ status: "PAID", startDate: "2026-10-01", endDate: "2026-10-31", lotId: "lot", eventId: "event" }, "org", ["event"]);
    expect(where).toMatchObject({ event: { organizationId: "org", id: { in: ["event"] } }, eventId: "event", items: { some: { lotId: "lot" } }, paidAt: { gte: new Date("2026-10-01T03:00:00Z"), lte: new Date("2026-11-01T02:59:59.999Z") } });
  });
  it("consolidates categories within each event, counts issued tickets and separates numbered boxes", async () => {
    db.event.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    db.event.findFirst.mockImplementation(({ where }) => ({ id: where.id, title: where.id, lots: [
      { id: "meia", name: "OURO - MEIA", typeOptions: [], seatSections: [] },
      { id: "inteira", name: "OURO - INTEIRA", typeOptions: [], seatSections: [] },
      { id: "box", name: "CAMAROTE 10 PESSOAS", typeOptions: [{ id: "07", label: "CAMAROTE 07" }], seatSections: [] }
    ] }));
    db.ticket.groupBy.mockResolvedValueOnce([{ lotId: "meia", _count: { _all: 2 } }, { lotId: "inteira", _count: { _all: 4 } }, { lotId: "box", lotOptionId: "07", _count: { _all: 10 } }]).mockResolvedValueOnce([{ lotId: "inteira", _count: { _all: 3 } }]);
    const r = await getOrdersSectorReport({ lotId: "selected", status: "PAID" }, "org", ["a", "b"]);
    expect(r.total).toBe(19);
    expect(r.groups.map(g => g.total)).toEqual([16, 3]);
    expect(r.groups[0].rows.map(({ revenueInCents, ...row }) => row)).toEqual([{ name: "CAMAROTE 07", quantity: 10 }, { name: "OURO", quantity: 6 }]);
    expect(db.ticket.groupBy.mock.calls[0][0].where).toMatchObject({ lotId: "selected", status: { in: ["ACTIVE", "USED"] }, order: { status: "PAID", AND: [{ status: "PAID" }] } });
  });
  it("does not substitute paid sales for an explicit canceled filter or bypass an empty event scope", async () => {
    db.event.findMany.mockResolvedValue([]);
    expect((await getOrdersSectorReport({ status: "CANCELED" }, "org", [])).total).toBe(0);
    expect(db.event.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: "org", id: { in: [] }, orders: { some: { status: "PAID", AND: [{ status: "CANCELED" }] } } });
    expect(db.ticket.groupBy).not.toHaveBeenCalled();
  });
  it("restricts the event query by both the selected event and permitted scope", async () => {
    db.event.findMany.mockResolvedValue([]);
    await getOrdersSectorReport({ eventId: "selected", status: "PAID" }, "org", ["allowed"]);
    expect(db.event.findMany.mock.calls[0][0].where).toMatchObject({
      organizationId: "org", AND: [{ id: "selected" }], id: { in: ["allowed"] },
      orders: { some: { AND: [{ eventId: "selected" }] } }
    });
  });
  it("writes event totals and an exact grand total with a paginated long report", () => {
    const groups = Array.from({ length: 25 }, (_, i) => ({ title: `Evento ${i}`, rows: [{ name: "OURO", quantity: 10 }], total: 10 }));
    const pdf = buildEventSectorPdf({ event: { title: "Vendas no período" }, rows: [], groups, total: 250, filters: ["2026-10-01 a 2026-10-31"] }).toString("latin1");
    expect(pdf).toContain("TOTAL GERAL: 250 INGRESSOS");
    expect(pdf.match(/TOTAL DO EVENTO: 10 INGRESSOS/g)).toHaveLength(25);
    expect(pdf.match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
  });
});
