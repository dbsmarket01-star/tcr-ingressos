import { NextResponse } from "next/server";
import { getCurrentAdmin, canAccessArea } from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";
import { A2_BIO_CAMPAIGNS } from "@/features/tracking/a2-bio";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin || !canAccessArea(admin.role, "ORDERS")) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: admin.organizationId },
    select: { slug: true }
  });
  if (organization?.slug !== "a2-imergidos") {
    return NextResponse.json({ error: "Relatório disponível apenas para A2 Imergidos." }, { status: 404 });
  }

  const links = await Promise.all(
    Object.entries(A2_BIO_CAMPAIGNS).map(async ([name, config]) => {
      const [clicks, orders] = await Promise.all([
        prisma.bioLinkClick.count({
          where: { organizationId: admin.organizationId, campaign: config.campaign }
        }),
        prisma.order.aggregate({
          where: {
            event: { organizationId: admin.organizationId },
            status: "PAID",
            utmCampaign: config.campaign
          },
          _count: { id: true },
          _sum: { totalInCents: true }
        })
      ]);
      return {
        name,
        campaign: config.campaign,
        clicks,
        paidOrders: orders._count.id,
        grossSalesInCents: orders._sum.totalInCents ?? 0
      };
    })
  );

  return NextResponse.json({ links }, { headers: { "Cache-Control": "private, no-store" } });
}
