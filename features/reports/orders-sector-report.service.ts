import { prisma } from "@/lib/prisma";
import { buildReportOrderWhere, type AdminOrderFilters } from "@/features/orders/order.admin.service";
import { getEventSectorReport } from "./event-sector-report.service";

export async function getOrdersSectorReport(filters: AdminOrderFilters, organizationId: string, allowedEventIds?: string[] | null) {
  // Keep the exact order filters as an AND: an explicit non-paid status yields no sales.
  const orderWhere = await buildReportOrderWhere(filters, organizationId, allowedEventIds);
  const events = await prisma.event.findMany({
    where: { organizationId,
      ...(filters.eventId ? { AND: [{ id: filters.eventId }] } : {}), ...(allowedEventIds ? { id: { in: allowedEventIds } } : {}),
      orders: { some: { AND: [orderWhere], status: "PAID" } } },
    select: { id: true }, orderBy: { title: "asc" }
  });
  const groups = [];
  for (const event of events) {
    const report = await getEventSectorReport(organizationId, event.id, allowedEventIds, { orderWhere, lotId: filters.lotId, grouping: "category" });
    if (report && report.total > 0) groups.push({ title: report.event.title, solidarityTotal: report.solidarityTotal, rows: report.rows, total: report.total, revenueInCents: report.revenueInCents });
  }
  return { groups, revenueInCents: groups.reduce((sum, group) => sum + group.revenueInCents, 0), total: groups.reduce((sum, group) => sum + group.total, 0) };
}
