import { NextResponse } from "next/server";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";
import { getPublicTicketUrl } from "@/lib/public-url";
import { buildScheduleLines, buildTicketsPdf, type TicketPdfInput } from "@/lib/ticket-pdf";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

function sanitizeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "pedido";
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { code } = await params;
  const organizationContext = await getCurrentOrganizationContext();
  const order = await prisma.order.findFirst({
    where: {
      code,
      event: {
        organizationId: organizationContext.organization.id
      }
    },
    include: {
      customer: true,
      event: true,
      tickets: {
        orderBy: {
          issuedAt: "asc"
        },
        include: {
          lot: true,
          lotOption: true
        }
      }
    }
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
  }

  if (order.tickets.length === 0) {
    return NextResponse.json({ error: "Este pedido ainda nao possui ingressos emitidos." }, { status: 404 });
  }

  const scheduleLines = buildScheduleLines();
  const ticketInputs: TicketPdfInput[] = order.tickets.map((ticket) => ({
    brandName: organizationContext.brandName,
    brandPrimaryColor: organizationContext.organization.primaryColor,
    eventTitle: order.event.title,
    eventDate: order.event.startsAt,
    venue: `${order.event.venueName} - ${order.event.city}, ${order.event.state}`,
    address: order.event.venueAddress,
    buyerName: order.customer.name,
    orderCode: order.code,
    ticketCode: ticket.code,
    ticketName: ticket.lotOption?.label ? `${ticket.lot.name} - ${ticket.lotOption.label}` : ticket.lot.name,
    issuedAt: ticket.issuedAt,
    qrCodeToken: ticket.qrCodeToken,
    ticketUrl: getPublicTicketUrl(ticket.code, organizationContext.organization),
    scheduleLines
  }));
  const pdf = buildTicketsPdf(ticketInputs);

  return new NextResponse(pdf, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ingressos-${sanitizeFilename(order.code)}.pdf"`
    }
  });
}
