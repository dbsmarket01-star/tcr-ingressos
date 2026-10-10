import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getEventSectorReport } from "@/features/reports/event-sector-report.service";
import { buildEventSectorPdf } from "@/features/reports/event-sector-report-pdf";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  const report = await getEventSectorReport(admin.organizationId, eventId, getAdminAllowedEventIds(admin));
  if (!report) return new NextResponse("Evento não encontrado.", { status: 404 });
  return new NextResponse(buildEventSectorPdf(report), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="ingressos-por-setor-${report.event.slug}.pdf"`,
    "Cache-Control": "private, no-store"
  } });
}
