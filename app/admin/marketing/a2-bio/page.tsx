import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { A2_BIO_CAMPAIGNS } from "@/features/tracking/a2-bio";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function A2BioReportPage() {
  const admin = await requirePermission("ORDERS");
  const organization = await prisma.organization.findUnique({
    where: { id: admin.organizationId },
    select: { slug: true, publicDomain: true }
  });
  if (organization?.slug !== "a2-imergidos") notFound();

  const rows = await Promise.all(
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
        path: name === "gramado" ? "/bio/a2/gramado" : "/bio/a2",
        clicks,
        paidOrders: orders._count.id,
        grossSalesInCents: orders._sum.totalInCents ?? 0
      };
    })
  );

  const base = `https://www.${organization.publicDomain?.replace(/^www\./, "") || "a2imergidos.com.br"}`;
  return (
    <AdminShell title="Links da bio · A2" description="Cliques nos atalhos do Instagram e pedidos pagos atribuídos a cada campanha.">
      <section className="card adminPanelBlock spacedSection">
        <div className="tableScroll wideTableScroll adminTableWrap">
          <table className="table operationalTable">
            <thead><tr><th>Link</th><th>Cliques</th><th>Pedidos pagos</th><th>Vendas brutas</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.name}>
                <td><a href={`${base}${row.path}`}>{base}{row.path}</a></td>
                <td>{row.clicks}</td>
                <td>{row.paidOrders}</td>
                <td>{(row.grossSalesInCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="muted">Cliques contam aberturas do link, inclusive visitas repetidas. Vendas contam apenas pedidos pagos com a campanha registrada; bloqueadores, troca de dispositivo ou links compartilhados podem afetar a atribuição.</p>
      </section>
    </AdminShell>
  );
}
