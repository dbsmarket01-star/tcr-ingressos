import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { listAdminTickets, listTicketFilterEvents } from "@/features/tickets/ticket.admin.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const ticketStatusLabels = {
  ACTIVE: "Ativo",
  USED: "Usado",
  CANCELED: "Cancelado",
  INVALID: "Inválido"
};

type TicketsPageProps = {
  searchParams?: Promise<{
    eventId?: string;
    status?: string;
    search?: string;
  }>;
};

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  await requirePermission("TICKETS");
  const params = searchParams ? await searchParams : {};
  const [{ tickets, totalCount }, events] = await Promise.all([
    listAdminTickets(params),
    listTicketFilterEvents()
  ]);
  const activeCount = tickets.filter((ticket) => ticket.status === "ACTIVE").length;
  const usedCount = tickets.filter((ticket) => ticket.status === "USED").length;
  const canceledCount = tickets.filter((ticket) => ticket.status === "CANCELED").length;
  const exportHref = `/admin/tickets/export?${new URLSearchParams({
    ...(params.eventId ? { eventId: params.eventId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.search ? { search: params.search } : {})
  }).toString()}`;

  return (
    <AdminShell
      title="Ingressos"
      description="Ingressos emitidos, status, comprador e vínculo com pedido."
    >
      <section className="grid dashboardGrid">
        <article className="card metric">
          <span className="muted">Total listado</span>
          <strong>{tickets.length}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Ativos</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Usados</span>
          <strong>{usedCount}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Cancelados</span>
          <strong>{canceledCount}</strong>
        </article>
      </section>

      <section className="card financeFilters">
        <form className="financeFiltersForm">
          <label className="field">
            <span>Buscar</span>
            <input name="search" placeholder="Ingresso, pedido, cliente, email, evento ou lote" defaultValue={params.search || ""} />
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
              {Object.entries(ticketStatusLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
          <Link className="secondaryButton" href="/admin/tickets">
            Limpar
          </Link>
          <Link className="button" href={exportHref}>
            Exportar CSV
          </Link>
        </form>
        <p className="muted filterSummary">
          Mostrando {tickets.length} de {totalCount} ingresso(s).
        </p>
      </section>

      <section className="card">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Ingressos emitidos</h2>
            <p className="muted">Localize o ingresso, confira o comprador e abra o pedido ou o QR Code em poucos cliques.</p>
          </div>
          <Link className="button" href={exportHref}>
            Exportar CSV
          </Link>
        </div>
        {tickets.length === 0 ? (
          <div className="empty">Nenhum ingresso emitido ainda.</div>
        ) : (
          <div className="tableScroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Ingresso</th>
                  <th>Status</th>
                  <th>Evento</th>
                  <th>Lote</th>
                  <th>Comprador</th>
                  <th>Pedido</th>
                  <th>Emitido em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <Link href={`/ingresso/${ticket.code}`}>
                        <strong>{ticket.code}</strong>
                      </Link>
                    </td>
                    <td>
                      <span className={`status ${ticket.status === "ACTIVE" ? "published" : "draft"}`}>
                        {ticketStatusLabels[ticket.status]}
                      </span>
                    </td>
                    <td>{ticket.event.title}</td>
                    <td>{ticket.lot.name}</td>
                    <td>
                      {ticket.order.customer.name}
                      <br />
                      <span className="muted">{ticket.order.customer.email}</span>
                    </td>
                    <td>
                      <Link href={`/admin/orders/${ticket.order.code}`}>{ticket.order.code}</Link>
                    </td>
                    <td>{formatDateTime(ticket.issuedAt)}</td>
                    <td>
                      <div className="actionRow">
                        <Link className="secondaryButton smallButton" href={`/ingresso/${ticket.code}`}>
                          Abrir QR
                        </Link>
                        <Link className="secondaryButton smallButton" href={`/admin/support?q=${encodeURIComponent(ticket.code)}`}>
                          Atender
                        </Link>
                      </div>
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
