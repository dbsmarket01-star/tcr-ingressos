import { describe, expect, it, vi } from "vitest";
import { consolidateSectors, sectorFromLotName } from "@/features/reports/event-sector-report";
import { buildEventSectorPdf } from "@/features/reports/event-sector-report-pdf";
const db = vi.hoisted(() => ({ event: { findFirst: vi.fn() }, ticket: { groupBy: vi.fn() }, seat: { findMany: vi.fn() } }));
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
    db.event.findFirst.mockResolvedValue({ id: "event", title: "Event", slug: "event", lots: [{ id: "lot", name: "OURO - MEIA", seatSections: [] }] });
    db.ticket.groupBy.mockResolvedValue([{ lotId: "lot", seatId: null, _count: { _all: 4 } }, { lotId: "lot", seatId: "seat", _count: { _all: 1 } }]);
    db.seat.findMany.mockResolvedValue([{ id: "seat", section: { name: "Balcão" } }]);
    const r = await getEventSectorReport("org", "event", ["event"]);
    expect(r?.total).toBe(5);
    expect(r?.rows).toEqual([{ name: "BALCÃO", quantity: 1 }, { name: "OURO", quantity: 4 }]);
    expect(db.event.findFirst.mock.calls.at(-1)?.[0].where).toEqual({ id: "event", organizationId: "org" });
    expect(db.ticket.groupBy.mock.calls.at(-1)?.[0].where).toMatchObject({ eventId: "event", status: { in: ["ACTIVE", "USED"] }, order: { status: "PAID" } });
  });
  it("paginates without losing sector rows or duplicating the overall total", () => {
    const rows = Array.from({ length: 90 }, (_, i) => ({ name: `SETOR ${i}`, quantity: i }));
    const pdf = buildEventSectorPdf({ event: { title: "Evento São André" }, rows, total: 4005 }).toString("latin1");
    expect(pdf).toContain("/Count 5");
    expect(pdf.match(/TOTAL GERAL/g)).toHaveLength(1);
    expect(pdf.match(/TOTAL:/g)).toHaveLength(90);
    expect(pdf).toContain("4.005 INGRESSOS");
  });
});
