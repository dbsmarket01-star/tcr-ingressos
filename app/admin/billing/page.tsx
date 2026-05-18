import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  await requirePermission("BILLING");
  const params = searchParams ? await searchParams : {};
  const gatewayStatus = typeof params.gatewayStatus === "string" ? params.gatewayStatus : "";

  const paymentEvents = await prisma.subscriptionPaymentEvent.findMany({
    where: gatewayStatus ? { gatewayStatus } : undefined,
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    include: {
      subscription: {
        include: {
          user: {
            select: { name: true, email: true }
          },
          plan: true
        }
      }
    }
  });

  return (
    <AdminShell
      title="Faturamento"
      description="Eventos financeiros vindos do Asaas e impacto no acesso ao servico."
    >
      <section className="dashboardFilterPanel">
        <form className="dashboardDateForm">
          <label>
            <span>Status gateway</span>
            <input name="gatewayStatus" defaultValue={gatewayStatus} placeholder="RECEIVED, OVERDUE..." />
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
        </form>
      </section>

      <section className="dashboardPanel">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Eventos de pagamento</h2>
            <p>Base inicial para reconciliacao e operacao do billing.</p>
          </div>
        </div>
        {paymentEvents.length === 0 ? (
          <div className="empty">Nenhum evento de pagamento recebido.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Plano</th>
                  <th>Status gateway</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Recebido</th>
                  <th>Registrado</th>
                </tr>
              </thead>
              <tbody>
                {paymentEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      {event.subscription.user.name}
                      <br />
                      <span className="muted">{event.subscription.user.email}</span>
                    </td>
                    <td>{event.subscription.plan.name}</td>
                    <td>{event.gatewayStatus}</td>
                    <td>{event.amountInCents ? formatCurrency(event.amountInCents) : "-"}</td>
                    <td>{event.dueDate ? formatDateTime(event.dueDate) : "-"}</td>
                    <td>{event.paidAt ? formatDateTime(event.paidAt) : "-"}</td>
                    <td>{formatDateTime(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
