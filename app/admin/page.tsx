import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getDashboardMetrics } from "@/features/dashboard/dashboard.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const eventStatusLabels = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  UNPUBLISHED: "Despublicado",
  FINISHED: "Encerrado",
  CANCELED: "Cancelado"
};

const orderStatusLabels = {
  DRAFT: "Rascunho",
  PENDING_PAYMENT: "Pendente",
  PAID: "Pago",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado"
};

export default async function AdminPage() {
  await requirePermission("DASHBOARD");
  const dashboard = await getDashboardMetrics();

  return (
    <AdminShell
      title="Dashboard"
      description="Visao real da operacao: vendas, pedidos, ingressos, check-ins e desempenho por evento."
    >
      <section className="grid dashboardGrid" aria-label="Metricas principais">
        <div className="card metric">
          <span className="muted">Faturamento pago</span>
          <strong>{formatCurrency(dashboard.totals.revenueInCents)}</strong>
        </div>
        <div className="card metric">
          <span className="muted">Pedidos pagos</span>
          <strong>{dashboard.totals.paidOrders}</strong>
        </div>
        <div className="card metric">
          <span className="muted">Ingressos emitidos</span>
          <strong>{dashboard.totals.ticketsIssued}</strong>
        </div>
        <div className="card metric">
          <span className="muted">Check-ins aprovados</span>
          <strong>{dashboard.totals.checkInsApproved}</strong>
        </div>
      </section>

      <section className="grid dashboardGrid secondaryMetrics" aria-label="Status de operacao">
        <div className="card metric">
          <span className="muted">Pedidos pendentes</span>
          <strong>{dashboard.totals.pendingOrders}</strong>
        </div>
        <div className="card metric">
          <span className="muted">Pedidos cancelados</span>
          <strong>{dashboard.totals.canceledOrders}</strong>
        </div>
        <div className="card metric">
          <span className="muted">Ingressos ativos</span>
          <strong>{dashboard.totals.ticketsActive}</strong>
        </div>
        <div className="card metric">
          <span className="muted">Bloqueios no check-in</span>
          <strong>{dashboard.totals.checkInsBlocked}</strong>
        </div>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Visao por evento</h2>
          <Link className="button" href="/admin/events/new">
            Novo evento
          </Link>
        </div>

        {dashboard.events.length === 0 ? (
          <div className="empty">Nenhum evento cadastrado ainda.</div>
        ) : (
          <div className="tableScroll">
          <table className="table operationalTable">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Status</th>
                <th>Data</th>
                <th>Vendidos</th>
                <th>Reservados</th>
                <th>Faturamento</th>
                <th>Check-in</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.events.map((event) => {
                const progress =
                  event.totalCapacity > 0
                    ? Math.round((event.soldQuantity / event.totalCapacity) * 100)
                    : 0;

                return (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.title}</strong>
                      <br />
                      <span className="muted">
                        {event.city}, {event.state}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status ${
                          event.status === "PUBLISHED" ? "published" : "draft"
                        }`}
                      >
                        {eventStatusLabels[event.status]}
                      </span>
                    </td>
                    <td>{formatDateTime(event.startsAt)}</td>
                    <td>
                      <div className="progressCell">
                        <div className="progressMeta">
                          <span>
                            {event.soldQuantity} / {event.totalCapacity}
                          </span>
                          <strong>{progress}%</strong>
                        </div>
                        <div className="progressTrack" aria-label={`${progress}% vendido`}>
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>{event.reservedQuantity}</td>
                    <td>
                      <strong>{formatCurrency(event.revenueInCents)}</strong>
                    </td>
                    <td>
                      {event.usedTickets} usados
                      <br />
                      <span className="muted">{event.activeTickets} ativos</span>
                    </td>
                    <td>
                      <div className="actionRow">
                        <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}`}>
                          Gerenciar
                        </Link>
                        <Link className="secondaryButton smallButton" href={`/evento/${event.slug}`}>
                          Publico
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Pedidos recentes</h2>
          <Link className="secondaryButton" href="/admin/orders">
            Ver pedidos
          </Link>
        </div>

        {dashboard.recentOrders.length === 0 ? (
          <div className="empty">Nenhum pedido registrado ainda.</div>
        ) : (
          <div className="tableScroll">
          <table className="table operationalTable">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Evento</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th>Total</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/pedido/${order.code}`}>
                      <strong>{order.code}</strong>
                    </Link>
                  </td>
                  <td>
                    {order.customer.name}
                    <br />
                    <span className="muted">{order.customer.email}</span>
                  </td>
                  <td>{order.event.title}</td>
                  <td>
                    <span className={`status ${order.status === "PAID" ? "published" : "draft"}`}>
                      {orderStatusLabels[order.status]}
                    </span>
                  </td>
                  <td>{order.payment?.status ?? "-"}</td>
                  <td>{formatCurrency(order.totalInCents)}</td>
                  <td>{formatDateTime(order.createdAt)}</td>
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
