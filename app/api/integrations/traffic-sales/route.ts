import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTrafficSalesReport, listTrafficReportEvents, validateTrafficSalesFilters } from "@/features/integrations/traffic-sales.service";
import { isTrafficReportAuthorized } from "@/features/integrations/traffic-report-auth";

export const dynamic = "force-dynamic";

function reply(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isTrafficReportAuthorized(request)) return reply({ error: "UNAUTHORIZED" }, 401);
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "sales";
  if (view !== "sales" && view !== "events") return reply({ error: "INVALID_VIEW" }, 400);
  const filters = {
    startDate: url.searchParams.get("startDate") ?? "",
    endDate: url.searchParams.get("endDate") ?? "",
    eventId: url.searchParams.get("eventId") || undefined
  };
  if (view === "sales") {
    const error = validateTrafficSalesFilters(filters);
    if (error) return reply({ error }, 400);
  }
  try {
    const organization = await prisma.organization.findFirst({
      where: { slug: "tcr-ingressos", isActive: true }, select: { id: true }
    });
    if (!organization) return reply({ error: "ORGANIZATION_UNAVAILABLE" }, 503);
    if (view === "events") return reply(await listTrafficReportEvents(organization.id), 200);
    return reply(await getTrafficSalesReport(filters, organization.id), 200);
  } catch (error) {
    console.error("[traffic-sales] Falha na consulta agregada", error);
    return reply({ error: "REPORT_UNAVAILABLE" }, 503);
  }
}
