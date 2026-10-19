import { NextResponse } from "next/server";
import { canAccessEvent, requirePermission } from "@/features/auth/auth.service";
import {
  buyerReportCell,
  buyerReportCsvLine,
  buyerReportFields,
  buyerReportWhere,
  iterateEventBuyerTickets,
  parseBuyerReportFilters
} from "@/features/reports/event-buyers-report.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const admin = await requirePermission("REPORTS");
  const { eventId } = await params;
  if (!canAccessEvent(admin, eventId)) return new NextResponse("Evento não encontrado.", { status: 404 });
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: admin.organizationId },
    select: { id: true, slug: true }
  });
  if (!event) return new NextResponse("Evento não encontrado.", { status: 404 });

  const filters = parseBuyerReportFilters(new URL(request.url).searchParams);
  const count = await prisma.ticket.count({ where: buyerReportWhere(eventId, filters) });
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: admin.id,
      action: "EVENT_BUYERS_CSV_EXPORTED",
      entityType: "Event",
      entityId: eventId,
      metadata: { count, fields: filters.fields, lotId: filters.lotId ?? null, status: filters.status, searched: Boolean(filters.search) }
    }
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`\uFEFF${buyerReportCsvLine(filters.fields.map((field) => buyerReportFields[field]))}`));
        for await (const batch of iterateEventBuyerTickets(eventId, filters)) {
          for (const ticket of batch) {
            controller.enqueue(encoder.encode(buyerReportCsvLine(filters.fields.map((field) => buyerReportCell(ticket, field)))));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compradores-${event.slug.replace(/[^a-z0-9-]/g, "")}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
