import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { A2_BIO_CAMPAIGNS, getA2BioDestination } from "@/features/tracking/a2-bio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const organization = await prisma.organization.findUnique({
    where: { slug: "a2-imergidos" },
    select: { id: true, publicDomain: true, isActive: true }
  });
  if (!organization?.isActive || !organization.publicDomain) {
    return new NextResponse("Bilheteria indisponível.", { status: 503 });
  }

  const destination = getA2BioDestination(`https://${organization.publicDomain}/bio/a2`, "geral");
  try {
    await prisma.bioLinkClick.create({
      data: { organizationId: organization.id, campaign: A2_BIO_CAMPAIGNS.geral.campaign }
    });
  } catch (error) {
    console.error("[a2-bio] Falha ao registrar clique", error);
  }

  return NextResponse.redirect(destination, {
    status: 307,
    headers: { "Cache-Control": "private, no-store" }
  });
}
