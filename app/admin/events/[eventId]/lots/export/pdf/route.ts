import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getEventTicketSalesReport } from "@/features/reports/event-ticket-sales-report.service";
import { buildEventTicketSalesPdf } from "@/features/reports/event-ticket-sales-report-pdf";

export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  const report = await getEventTicketSalesReport(admin.organizationId, eventId, getAdminAllowedEventIds(admin));

  if (!report) {
    notFound();
  }

  const pdf = buildEventTicketSalesPdf(report);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="resumo-ingressos-${report.event.slug}.pdf"`
    }
  });
}
