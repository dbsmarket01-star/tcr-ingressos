import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { cancelPendingOrderAction, expirePendingOrdersAction } from "@/features/orders/order.admin.actions";
import { getOrdersSummary, listAdminOrders, listOrderFilterEvents } from "@/features/orders/order.admin.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const orderStatusLabels = {
  DRAFT: "Rascunho",
  PENDING_PAYMENT: "Pendente",
  PAID: "Pago",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado"
};

type OrdersPageProps = {
  searchParams?: Promise<{
    expired?: string;
    released?: string;
    eventId?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    canceled?: string;
    orderError?: string;
  }>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  await requirePermission("ORDERS");
  const params = searchParams ? await searchParams : {};
  const [{ orders, totalCount }, events, summary] = await Promise.all([
    listAdminOrders(params),
    listOrderFilterEvents(),
    getOrdersSummary(params)
  ]);
  const exportHref = `/admin/orders/export?${new URLSearchParams({
    ...(params.eventId ? { eventId: params.eventId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.search ? { search: params.search } : {}),
    ...(params.startDate ? { startDate: params.startDate } : {}),
    ...(params.endDate ? { endDate: params.endDate } : {})
  }).toString()}`;

  return (
    <AdminShell
      title="Pedidos"
      description="Acompanhe compras, clientes, itens, pagamentos e status operacional."
    >
      <section className="grid dashboardGrid">
        <article className="card metric">
          <span className="muted">Pedidos pagos</span>
          <strong>{summary.paidOrders}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Pendentes</span>
          <strong>{summary.pendingOrders}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Cancelados/expirados</span>
          <strong>{summary.canceledOrders}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Total filtrado</span>
          <strong>{formatCurrency(summary.totalInCents)}</strong>
        </article>
      </section>

      <section className="card orderMaintenance">
        <div>
          <h2>Reservas vencidas</h2>
          <p className="muted">
            Pedidos pendentes vencidos liberam automaticamente o estoque quando esta tela, o evento
            ou a rotina de manutencao rodam.
          </p>
          {params.expired ? (
            <p className="success">
              {params.expired} pedido(s) expirado(s), {params.released ?? "0"} ingresso(s) liberado(s).
            </p>
          ) : null}
          {params.canceled ? (
            <p className="success">
              Pedido {params.canceled} cancelado. {params.released ?? "0"} ingresso(s) liberado(s).
            </p>
          ) : null}
          {params.orderError ? <div className="errorBox">{params.orderError}</div> : null}
        </div>
        <form action={expirePendingOrdersAction}>
          <button className="secondaryButton" type="submit">
            Liberar reservas vencidas
          </button>
        </form>
        <Link className="button" href={exportHref}>
          Exportar CSV
        </Link>
      </section>

      <section className="card financeFilters">
        <form className="financeFiltersForm">
          <label className="field">
            <span>Buscar</span>
            <input
              name="search"
              placeholder="Pedido, cliente, email, CPF, cupom ou evento"
              defaultValue={params.search || ""}
            />
          </label>
          <label className="field">
            <span>Evento</span>
            <select name="eventId" defaultValue={params.eventId || ""}>
              <option value="">Todos os eventos</option>
              {events.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={params.status || ""}>
              <option value="">Todos</option>
              {Object.entries(orderStatusLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Inicio</span>
            <input type="date" name="startDate" defaultValue={params.startDate || ""} />
          </label>
          <label className="field">
            <span>Fim</span>
            <input type="date" name="endDate" defaultValue={params.endDate || ""} />
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
          <Link className="secondaryButton" href="/admin/orders">
            Limpar
          </Link>
        </form>
        <p className="muted filterSummary">
          Mostrando {orders.length} de {totalCount} pedido(s). A exportacao CSV usa estes mesmos filtros.
        </p>
      </section>

      <section className="card">
        {orders.length === 0 ? (
          <div className="empty">Nenhum pedido registrado ainda.</div>
        ) : (
          <div className="tableScroll wideTableScroll">
          <table className="table operationalTable ordersTable">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Evento</th>
                <th>Itens</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th>Origem</th>
                <th>Taxas</th>
                <th>Juros</th>
                <th>Desconto</th>
                <th>Total</th>
                <th>Expira em</th>
                <th>Criado em</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/orders/${order.code}`}>
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
                    {order.items.map((item) => (
                      <div key={item.id}>
                        {item.quantity}x {item.lot.name}
                      </div>
                    ))}
                  </td>
                  <td>
                    <span className={`status ${order.status === "PAID" ? "published" : "draft"}`}>
                      {orderStatusLabels[order.status]}
                    </span>
                  </td>
                  <td>{order.payment?.status ?? "-"}</td>
                  <td>
                    {order.utmSource || order.utmMedium ? (
                      <>
                        {order.utmSource ?? "-"} / {order.utmMedium ?? "-"}
                        {order.utmCampaign ? (
                          <>
                            <br />
                            <span className="muted">{order.utmCampaign}</span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      "Direto"
                    )}
                  </td>
                  <td>{formatCurrency(order.serviceFeeInCents)}</td>
                  <td>{formatCurrency(order.cardInterestInCents)}</td>
                  <td>{formatCurrency(order.discountInCents)}</td>
                  <td>{formatCurrency(order.totalInCents)}</td>
                  <td>{order.expiresAt ? formatDateTime(order.expiresAt) : "-"}</td>
                  <td>{formatDateTime(order.createdAt)}</td>
                  <td>
                    {order.status === "PENDING_PAYMENT" || order.status === "EXPIRED" ? (
                      <form action={cancelPendingOrderAction}>
                        <input type="hidden" name="orderCode" value={order.code} />
                        <button className="secondaryButton smallButton" type="submit">
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
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
