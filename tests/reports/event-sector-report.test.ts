import { describe, expect, it, vi } from "vitest";
import { allocateSectorRevenue, consolidateSectors, sectorFromLotName } from "@/features/reports/event-sector-report";
import { buildEventSectorPdf } from "@/features/reports/event-sector-report-pdf";
const db = vi.hoisted(() => ({ event: { findFirst: vi.fn() }, orderItem: { findMany: vi.fn().mockResolvedValue([]) }, ticket: { groupBy: vi.fn() }, seat: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { getEventSectorReport } from "@/features/reports/event-sector-report.service";

describe("event sector report", () => {
  it("consolidates arbitrary sectors and all categories without hardcoding sectors", () => {
    const entries = ["MEIA ENTRADA", "INTEIRA", "CORTESIA", "ESTUDANTE", "PCD", "PROMOCIONAL", "SOLIDÁRIO"].map(category => ({ name: sectorFromLotName(`TERRAÇO NORTE - ${category}`), quantity: 2 }));
    expect(consolidateSectors(entries)).toEqual({ rows: [{ name: "TERRAÇO NORTE", quantity: 14 }], total: 14 });
    expect(sectorFromLotName("CADEIRA OURO DUPLO - SOLIDÁRIO")).toBe("CADEIRA OURO");
    expect(sectorFromLotName("CAMAROTE 18 - COMPARTILHADO")).toBe("CAMAROTE 18");
    expect(sectorFromLotName("MESA VIP - 4 LUGARES")).toBe("MESA VIP");
    expect(sectorFromLotName("CORTESIA")).toBe("SEM SETOR IDENTIFICADO");
  });
  it("sums every sector, including zero sales, without collapsing distinct areas", () => {
    const report = consolidateSectors([{ name: "Ouro", quantity: 300 }, { name: "OURO", quantity: 1000 }, { name: "Balcão", quantity: 0 }, { name: "Camarote 18", quantity: 10 }, { name: "Camarote 19", quantity: 20 }]);
    expect(report.total).toBe(1330);
    expect(report.rows).toHaveLength(4);
    expect(report.rows.find(r => r.name === "OURO")?.quantity).toBe(1300);
  });
  it("does not query unauthorized events", async () => {
    db.event.findFirst.mockClear();
    expect(await getEventSectorReport("org", "forbidden", [])).toBeNull();
    expect(db.event.findFirst).not.toHaveBeenCalled();
  });
  it("uses issued admissions and physical seat sections with paid/valid scope", async () => {
    db.event.findFirst.mockResolvedValue({ id: "event", title: "Event", slug: "event", lots: [{ id: "lot", name: "OURO - MEIA", typeOptions: [], seatSections: [] }] });
    db.ticket.groupBy.mockResolvedValue([{ lotId: "lot", seatId: null, _count: { _all: 4 } }, { lotId: "lot", seatId: "seat", _count: { _all: 1 } }]);
    db.seat.findMany.mockResolvedValue([{ id: "seat", section: { name: "Balcão" } }]);
    const r = await getEventSectorReport("org", "event", ["event"]);
    expect(r?.total).toBe(5);
    expect(r?.rows.map(({ revenueInCents, ...row }) => row)).toEqual([{ name: "BALCÃO", quantity: 1 }, { name: "OURO", quantity: 4 }]);
    expect(db.event.findFirst.mock.calls.at(-1)?.[0].where).toEqual({ id: "event", organizationId: "org" });
    expect(db.ticket.groupBy.mock.calls.at(-1)?.[0].where).toMatchObject({ eventId: "event", status: { in: ["ACTIVE", "USED"] }, order: { status: "PAID" } });
  });
  it("keeps each private box separate and preserves shared boxes and total admissions", async () => {
    db.event.findFirst.mockResolvedValue({ id: "event", title: "Event", slug: "event", lots: [
      { id: "closed", name: "CAMAROTE PARA 10 PESSOAS", typeOptions: [{ id: "box7", label: "CAMAROTE 07" }, { id: "box8", label: "CAMAROTE 08" }], seatSections: [{ name: "CAMAROTES" }] },
      { id: "shared", name: "CAMAROTE 18 - COMPARTILHADO", typeOptions: [], seatSections: [] }
    ] });
    db.ticket.groupBy.mockResolvedValue([
      { lotId: "closed", seatId: null, lotOptionId: "box7", _count: { _all: 10 } },
      { lotId: "closed", seatId: null, lotOptionId: "box8", _count: { _all: 10 } },
      { lotId: "shared", seatId: null, lotOptionId: null, _count: { _all: 9 } }
    ]);
    const report = await getEventSectorReport("org", "event");
    expect(report?.rows.map(({ revenueInCents, ...row }) => row)).toEqual([{ name: "CAMAROTE 07", quantity: 10 }, { name: "CAMAROTE 08", quantity: 10 }, { name: "CAMAROTE 18", quantity: 9 }]);
    expect(report?.total).toBe(29);
    expect(db.ticket.groupBy.mock.calls.at(-1)?.[0].by).toContain("lotOptionId");
  });
  it("does not list an unsold camarote option as a sale", async () => {
    db.event.findFirst.mockResolvedValue({ id: "event", title: "Rodrigo Teaser em São Caetano do Sul", slug: "sao-caetano", lots: [
      { id: "box", name: "CAMAROTE PARA 10 PESSOAS", typeOptions: [{ id: "m3", label: "M3" }, { id: "m8", label: "M8" }], seatSections: [] },
      { id: "empty", name: "PISTA - MEIA", typeOptions: [], seatSections: [] }
    ] });
    db.ticket.groupBy.mockResolvedValue([{ lotId: "box", seatId: null, lotOptionId: "m3", orderItemId: "sold", _count: { _all: 10 } }]);
    db.orderItem.findMany.mockResolvedValueOnce([{ id: "sold", totalInCents: 147900, order: { totalInCents: 147900, refundedInCents: 0 } }]);
    const report = await getEventSectorReport("org", "event");
    expect(report?.rows).toEqual([{ name: "CAMAROTE M3", quantity: 10, revenueInCents: 147900 }]);
    expect(report?.total).toBe(10);
    const pdf = buildEventSectorPdf(report!).toString("latin1");
    expect(pdf).toContain("CAMAROTE M3");
    expect(pdf).not.toContain("CAMAROTE M8");
    expect(pdf).not.toContain("PISTA");
  });
  it("does not list any configured sector when the event has no paid admissions", async () => {
    db.event.findFirst.mockResolvedValue({ id: "event", title: "Evento sem vendas", slug: "sem-vendas", lots: [
      { id: "lot", name: "CAMAROTE M8", typeOptions: [], seatSections: [] }
    ] });
    db.ticket.groupBy.mockResolvedValue([]);
    db.orderItem.findMany.mockResolvedValueOnce([]);
    const report = await getEventSectorReport("org", "event");
    expect(report?.rows).toEqual([]);
    expect(report?.total).toBe(0);
    expect(buildEventSectorPdf(report!).toString("latin1")).not.toContain("CAMAROTE M8");
  });
  it("allocates package revenue once and preserves cents across sectors", async () => {
    expect(allocateSectorRevenue(10000, [1, 1, 1])).toEqual([3333, 3334, 3333]);
    expect(allocateSectorRevenue(0, [10])).toEqual([0]);
    db.event.findFirst.mockResolvedValue({ id: "event", title: "Evento", lots: [{ id: "box", name: "CAMAROTE PARA 10 PESSOAS", typeOptions: [{ id: "7", label: "07" }, { id: "8", label: "08" }], seatSections: [] }] });
    db.ticket.groupBy.mockResolvedValue([{ orderItemId: "item", lotId: "box", lotOptionId: "7", _count: { _all: 10 } }, { orderItemId: "item", lotId: "box", lotOptionId: "8", _count: { _all: 10 } }]);
    db.orderItem.findMany.mockResolvedValueOnce([{ id: "item", totalInCents: 200000, order: { totalInCents: 240000, refundedInCents: 24000 } }]);
    const result = await getEventSectorReport("org", "event");
    expect(result?.total).toBe(20);
    expect(result?.revenueInCents).toBe(180000);
    expect(result?.rows.map(row => row.revenueInCents)).toEqual([90000, 90000]);
    const pdf = buildEventSectorPdf(result!).toString("latin1");
    expect(pdf).toContain("R$ 1.800,00");
    expect(pdf).toContain("R$ 900,00");
  });
  it("paginates without losing sector rows or duplicating the overall total", () => {
    const rows = Array.from({ length: 90 }, (_, i) => ({ name: `SETOR ${i}`, quantity: i }));
    const pdf = buildEventSectorPdf({ event: { title: "Evento São André" }, rows, total: 4005 }).toString("latin1");
    expect(pdf).toContain("/Count 5");
    expect(pdf.match(/TOTAL GERAL/g)).toHaveLength(1);
    for (const row of rows) expect(pdf.split(`(${row.name}) Tj`).length - 1).toBe(1);
    expect(pdf).toContain("4.005 INGRESSOS");
  });
});
