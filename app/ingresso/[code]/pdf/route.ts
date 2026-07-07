import { NextResponse } from "next/server";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getTicketByCode } from "@/features/tickets/ticket.service";
import { buildScheduleLines, buildTicketPdf } from "@/lib/ticket-pdf";
import { getPublicTicketUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { code } = await params;
  const organizationContext = await getCurrentOrganizationContext();
  const ticket = await getTicketByCode(code, organizationContext.organization.id);

  if (!ticket) {
    return NextResponse.json({ error: "Ingresso nao encontrado." }, { status: 404 });
  }

  const ticketUrl = getPublicTicketUrl(ticket.code, organizationContext.organization);
  const pdf = buildTicketPdf({
    brandName: organizationContext.brandName,
    brandPrimaryColor: organizationContext.organization.primaryColor,
    eventTitle: ticket.event.title,
    eventDate: ticket.event.startsAt,
    venue: `${ticket.event.venueName} - ${ticket.event.city}, ${ticket.event.state}`,
    address: ticket.event.venueAddress,
    buyerName: ticket.order.customer.name,
    orderCode: ticket.order.code,
    ticketCode: ticket.code,
    ticketName: ticket.lotOption?.label ? `${ticket.lot.name} - ${ticket.lotOption.label}` : ticket.lot.name,
    issuedAt: ticket.issuedAt,
    qrCodeToken: ticket.qrCodeToken,
    ticketUrl,
    scheduleLines: buildScheduleLines()
  });

  return new NextResponse(pdf, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ingresso-${ticket.code}.pdf"`
    }
  });
}
