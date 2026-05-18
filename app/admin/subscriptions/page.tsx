import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type SubscriptionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SubscriptionsPage({ searchParams }: SubscriptionsPageProps) {
  await requirePermission("SUBSCRIPTIONS");
  const params = searchParams ? await searchParams : {};
  const statusFilter = typeof params.status === "string" ? params.status : "";

  const subscriptions = await prisma.subscription.findMany({
    where: statusFilter ? { status: statusFilter as any } : undefined,
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
    include: {
      user: {
        select: { name: true, email: true, status: true }
      },
      plan: true
    }
  });

  return (
    <AdminShell
      title="Assinaturas"
      description="Trial, grace period, plano atual e sincronizacao com o Asaas."
    >
      <section className="dashboardFilterPanel">
        <form className="dashboardDateForm">
          <label>
            <span>Status</span>
            <select name="status" defaultValue={statusFilter}>
              <option value="">Todos</option>
              <option value="TRIALING">TRIALING</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAST_DUE">PAST_DUE</option>
              <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
              <option value="CANCELED">CANCELED</option>
              <option value="EXPIRED">EXPIRED</option>
            </select>
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
        </form>
      </section>

      <section className="dashboardPanel">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Carteira ativa</h2>
            <p>Assinaturas controladas por plano e status de pagamento.</p>
          </div>
        </div>
        {subscriptions.length === 0 ? (
          <div className="empty">Nenhuma assinatura registrada.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Status app</th>
                  <th>Preco</th>
                  <th>Fim do periodo</th>
                  <th>Grace</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td>
                      {subscription.user.name}
                      <br />
                      <span className="muted">{subscription.user.email}</span>
                    </td>
                    <td>{subscription.plan.name}</td>
                    <td>{subscription.status}</td>
                    <td>{subscription.user.status}</td>
                    <td>{formatCurrency(subscription.plan.priceInCents)}</td>
                    <td>{subscription.currentPeriodEndsAt ? formatDateTime(subscription.currentPeriodEndsAt) : "-"}</td>
                    <td>{subscription.graceEndsAt ? formatDateTime(subscription.graceEndsAt) : "-"}</td>
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
