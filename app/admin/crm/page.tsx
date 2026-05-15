import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCommercialKanbanBoard } from "@/features/crm/commercial-kanban.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type CrmPageProps = {
  searchParams?: Promise<{
    eventId?: string;
    search?: string;
  }>;
};

function buildFilterHref(params: { eventId?: string; search?: string }) {
  const searchParams = new URLSearchParams();

  if (params.eventId) {
    searchParams.set("eventId", params.eventId);
  }

  if (params.search) {
    searchParams.set("search", params.search);
  }

  const query = searchParams.toString();

  return query ? `/admin/crm?${query}` : "/admin/crm";
}

export default async function CrmPage({ searchParams }: CrmPageProps) {
  const admin = await requirePermission("CRM");
  const params = searchParams ? await searchParams : {};
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const organizationContext = await getCurrentOrganizationContext();
  const board = await getCommercialKanbanBoard(params, admin.organizationId, allowedEventIds);
  const activeEvent = board.events.find((event) => event.id === params.eventId);

  return (
    <AdminShell
      title="Central comercial"
      description="Kanban para acompanhar leads, carrinhos, pedidos pendentes e vendas aprovadas por evento."
    >
      <section className="operationCommandStrip spacedSection" aria-label="Visao geral da central comercial">
        <article className="operationCommandCard">
          <span className="eyebrow">CRM da bilheteria</span>
          <h2>{organizationContext.brandName} com leads, pedidos e WhatsApp no mesmo fluxo.</h2>
          <p>
            As colunas mudam conforme o proprio pedido evolui: lead captado, carrinho, pagamento, entrega do ingresso e check-in.
          </p>
        </article>
        <div className="operationCommandActions">
          <Link className="secondaryButton smallButton" href="/admin/events">
            Eventos
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/orders">
            Pedidos
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/finance">
            Financeiro
          </Link>
        </div>
      </section>

      <section className="grid dashboardGrid commercialSummaryGrid">
        <article className="card metric">
          <span className="muted">Cards no Kanban</span>
          <strong>{board.summary.cards}</strong>
          <small>{activeEvent ? activeEvent.title : "Todos os eventos"}</small>
        </article>
        <article className="card metric">
          <span className="muted">Leads sem pedido</span>
          <strong>{board.summary.leads}</strong>
          <small>Captados para recuperacao comercial</small>
        </article>
        <article className="card metric">
          <span className="muted">Oportunidades abertas</span>
          <strong>{board.summary.openOpportunities}</strong>
          <small>{formatCurrency(board.summary.potentialInCents)} em pedidos pendentes/recuperacao</small>
        </article>
        <article className="card dashboardHeroMetric metric">
          <span className="muted">Vendas confirmadas</span>
          <strong>{formatCurrency(board.summary.paidInCents)}</strong>
          <small>{board.summary.approvedSales} venda(s) pagas no quadro</small>
        </article>
      </section>

      <section className="card financeFilters adminPanelBlock commercialFilterPanel">
        <div className="filterPanelHeader">
          <div>
            <h2>Filtros do Kanban</h2>
            <p className="muted">
              Filtre por evento ou busque por nome, e-mail, telefone, CPF, igreja, pedido ou titulo do evento.
            </p>
          </div>
          <Link className="secondaryButton" href="/admin/crm">
            Limpar
          </Link>
        </div>
        <form className="financeFiltersForm commercialFilterForm">
          <label className="field">
            <span>Buscar</span>
            <input name="search" placeholder="Nome, telefone, pedido, igreja ou evento" defaultValue={params.search || ""} />
          </label>
          <label className="field">
            <span>Evento</span>
            <select name="eventId" defaultValue={params.eventId || ""}>
              <option value="">Todos os eventos</option>
              {board.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Atualizar Kanban
          </button>
        </form>
      </section>

      <section className="commercialKanbanShell" aria-label="Kanban comercial">
        <div className="commercialKanbanBoard">
          {board.columns.map((column) => (
            <article className="commercialKanbanColumn" key={column.id}>
              <header className="commercialKanbanColumnHeader">
                <div>
                  <h2>{column.title}</h2>
                  <p>{column.description}</p>
                </div>
                <span>{column.cards.length}</span>
              </header>
              <div className="commercialKanbanColumnTotal">{formatCurrency(column.totalInCents)}</div>
              <div className="commercialKanbanCards">
                {column.cards.length === 0 ? (
                  <div className="commercialKanbanEmpty">Nenhum card nesta etapa.</div>
                ) : (
                  column.cards.map((card) => (
                    <article className={`commercialKanbanCard stage${card.stage}`} key={card.id}>
                      <div className="commercialKanbanCardTop">
                        <span>{card.type === "ORDER" ? "Pedido" : "Lead"}</span>
                        <strong>{card.statusLabel}</strong>
                      </div>
                      <h3>{card.title}</h3>
                      <p>{card.subtitle}</p>
                      <div className="commercialKanbanEvent">
                        <strong>{card.eventTitle}</strong>
                        <span>{card.city}</span>
                      </div>
                      <div className="commercialKanbanMeta">
                        {card.amountInCents > 0 ? (
                          <span>
                            <b>Valor</b>
                            {formatCurrency(card.amountInCents)}
                          </span>
                        ) : null}
                        {card.paymentLabel ? (
                          <span>
                            <b>Pagamento</b>
                            {card.paymentLabel}
                          </span>
                        ) : null}
                        {card.quantity > 0 ? (
                          <span>
                            <b>Ingressos</b>
                            {card.quantity}
                          </span>
                        ) : null}
                        <span>
                          <b>Atualizado</b>
                          {formatDateTime(card.lastActivityAt)}
                        </span>
                      </div>
                      {card.lotNames.length > 0 || card.churchName || card.hasHotel ? (
                        <div className="commercialKanbanTags">
                          {card.hasHotel ? <span>Hotel</span> : null}
                          {card.churchName ? <span>{card.churchName}</span> : null}
                          {card.lotNames.slice(0, 2).map((lotName) => (
                            <span key={lotName}>{lotName}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="commercialKanbanContact">
                        {card.phone ? <span>{card.phone}</span> : null}
                        {card.email ? <span>{card.email}</span> : null}
                      </div>
                      <div className="commercialKanbanActions">
                        {card.whatsappHref ? (
                          <a className="button smallButton" href={card.whatsappHref} rel="noreferrer" target="_blank">
                            WhatsApp
                          </a>
                        ) : (
                          <span className="secondaryButton smallButton disabledButton">Sem WhatsApp</span>
                        )}
                        <Link className="secondaryButton smallButton" href={buildFilterHref({ eventId: card.eventId })}>
                          Evento
                        </Link>
                        <Link className="secondaryButton smallButton" href={card.detailHref}>
                          Abrir
                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
