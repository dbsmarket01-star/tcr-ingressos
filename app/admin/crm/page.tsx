import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { type CommercialKanbanCard, type CommercialKanbanStage, getCommercialKanbanBoard } from "@/features/crm/commercial-kanban.service";
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

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return (parts.map((part) => part.charAt(0)).join("") || "CL").toUpperCase();
}

function getColumnCta(stage: CommercialKanbanStage) {
  const labels: Record<CommercialKanbanStage, string> = {
    LEAD: "Ver todos os leads",
    ABANDONED: "Ver mais carrinhos",
    PENDING: "Ver mais pendentes",
    APPROVED: "Ver mais aprovadas",
    DELIVERED: "Ver mais entregues",
    CHECKED_IN: "Ver mais check-ins"
  };

  return labels[stage];
}

function getMetricIcon(kind: "money" | "bag" | "clock" | "check" | "send" | "qr") {
  const paths = {
    money: (
      <>
        <path d="M12 3v18" />
        <path d="M17 7.5c-.8-1.2-2.2-2-4.3-2H10.8C8.7 5.5 7 6.8 7 8.6c0 1.7 1.2 2.7 3.7 3.1l2.6.5c2.5.5 3.7 1.4 3.7 3.1 0 1.9-1.7 3.2-3.8 3.2h-2.2c-2 0-3.5-.8-4.3-2" />
      </>
    ),
    bag: (
      <>
        <path d="M7 8h10l1 12H6L7 8Z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.4 2" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8.5 12.2 2.3 2.3 4.8-5" />
      </>
    ),
    send: (
      <>
        <path d="m20 4-9.2 16-1.6-7.2L4 10.6 20 4Z" />
        <path d="m9.2 12.8 4.8-4.6" />
      </>
    ),
    qr: (
      <>
        <path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5z" />
        <path d="M14 14h2v2h-2zM17 14h2v5h-5v-2" />
      </>
    )
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[kind]}
    </svg>
  );
}

function ActionIcon({ kind }: { kind: "whatsapp" | "calendar" | "external" | "search" | "bell" | "dots" | "filter" | "pin" }) {
  const paths = {
    whatsapp: (
      <>
        <path d="M8.5 19.5 4 21l1.4-4.2A8 8 0 1 1 8.5 19.5Z" />
        <path d="M9.1 8.8c.2-.5.4-.6.8-.6h.6c.2 0 .4.1.5.4l.7 1.5c.1.3.1.5-.1.7l-.5.6c.5.9 1.2 1.6 2.2 2.1l.7-.5c.2-.2.5-.2.7-.1l1.4.7c.3.1.4.3.4.6v.6c0 .4-.2.7-.6.9-.5.3-1.1.4-1.7.3-2.8-.5-5.2-2.9-5.8-5.7-.1-.5.1-1.1.4-1.5Z" />
      </>
    ),
    calendar: (
      <>
        <path d="M7 4v3M17 4v3M5 9h14M6 6h12a1 1 0 0 1 1 1v12H5V7a1 1 0 0 1 1-1Z" />
      </>
    ),
    external: (
      <>
        <path d="M8 8h8v8" />
        <path d="m16 8-9 9" />
        <path d="M7 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 5 5" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
        <path d="M10 20h4" />
      </>
    ),
    dots: (
      <>
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="19" r="1" />
      </>
    ),
    filter: (
      <>
        <path d="M4 6h16M7 12h10M10 18h4" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s6-5.1 6-11a6 6 0 0 0-12 0c0 5.9 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    )
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[kind]}
    </svg>
  );
}

function MetricCard({
  kind,
  label,
  value,
  note,
  tone
}: {
  kind: "money" | "bag" | "clock" | "check" | "send" | "qr";
  label: string;
  value: string | number;
  note: string;
  tone: CommercialKanbanStage | "ORDERS";
}) {
  return (
    <article className={`crmMetricCard tone${tone}`}>
      <span className="crmMetricIcon">{getMetricIcon(kind)}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function KanbanCard({ card }: { card: CommercialKanbanCard }) {
  return (
    <article className={`crmDealCard tone${card.stage}`}>
      <div className="crmDealHeader">
        <span className="crmAvatar">{getInitials(card.title)}</span>
        <div>
          <h3>{card.title}</h3>
          <p>{card.eventTitle}</p>
        </div>
        <span className="crmStatusBadge">{card.statusLabel}</span>
      </div>

      <div className="crmDealDetails">
        <span>
          <ActionIcon kind="pin" />
          {card.city || "Local a definir"}
        </span>
        <span>
          <ActionIcon kind="calendar" />
          {card.amountInCents > 0 ? formatCurrency(card.amountInCents) : "Lead captado"}
        </span>
      </div>

      <div className="crmDealDate">
        <ActionIcon kind="calendar" />
        {formatDateTime(card.lastActivityAt)}
      </div>

      <div className="crmDealActions">
        {card.whatsappHref ? (
          <a className="crmIconButton crmWhatsappButton" href={card.whatsappHref} rel="noreferrer" target="_blank" title="Chamar no WhatsApp">
            <ActionIcon kind="whatsapp" />
          </a>
        ) : (
          <span className="crmIconButton isDisabled" title="Sem WhatsApp">
            <ActionIcon kind="whatsapp" />
          </span>
        )}
        <Link className="crmIconButton" href={buildFilterHref({ eventId: card.eventId })} title="Ver evento">
          <ActionIcon kind="calendar" />
        </Link>
        <Link className="crmIconButton" href={card.detailHref} title="Abrir cadastro">
          <ActionIcon kind="external" />
        </Link>
      </div>
    </article>
  );
}

export default async function CrmPage({ searchParams }: CrmPageProps) {
  const admin = await requirePermission("CRM");
  const params = searchParams ? await searchParams : {};
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const board = await getCommercialKanbanBoard(params, admin.organizationId, allowedEventIds);
  const columnsByStage = new Map(board.columns.map((column) => [column.id, column]));
  const allCards = board.columns.flatMap((column) => column.cards);
  const orderCount = allCards.filter((card) => card.type === "ORDER").length;
  const pendingCount = columnsByStage.get("PENDING")?.cards.length ?? 0;
  const approvedCount = columnsByStage.get("APPROVED")?.cards.length ?? 0;
  const deliveredCount = columnsByStage.get("DELIVERED")?.cards.length ?? 0;
  const checkedInCount = columnsByStage.get("CHECKED_IN")?.cards.length ?? 0;

  return (
    <AdminShell
      title="CRM / Kanban"
      description="Acompanhe e gerencie todo o fluxo de atendimento e vendas."
      headerVariant="minimal"
    >
      <div className="crmReferencePage">
        <header className="crmReferenceHeader">
          <div>
            <h1>CRM / Kanban</h1>
            <p>Acompanhe e gerencie todo o fluxo de atendimento e vendas.</p>
          </div>
          <div className="crmReferenceTools">
            <form className="crmTopSearch">
              <ActionIcon kind="search" />
              <input name="search" placeholder="Buscar por nome, e-mail, telefone, pedido..." defaultValue={params.search || ""} />
            </form>
            <button className="crmGhostIconButton" type="button" aria-label="Notificacoes">
              <ActionIcon kind="bell" />
              <span>12</span>
            </button>
            <button className="crmPlainIconButton" type="button" aria-label="Mais opcoes">
              <ActionIcon kind="dots" />
            </button>
          </div>
        </header>

        <section className="crmMetricStrip" aria-label="Resumo comercial">
          <MetricCard kind="money" label="Vendas totais" value={formatCurrency(board.summary.paidInCents)} note="+ 12% vs mes anterior" tone="APPROVED" />
          <MetricCard kind="bag" label="Pedidos" value={orderCount} note="+ 8% vs mes anterior" tone="ORDERS" />
          <MetricCard kind="clock" label="Pendentes" value={pendingCount} note="Aguardando pagamento" tone="PENDING" />
          <MetricCard kind="check" label="Aprovados" value={approvedCount} note="Pagamento confirmado" tone="APPROVED" />
          <MetricCard kind="send" label="Entregues" value={deliveredCount} note="Ingressos enviados" tone="DELIVERED" />
          <MetricCard kind="qr" label="Check-ins hoje" value={checkedInCount} note="Eventos em andamento" tone="CHECKED_IN" />
        </section>

        <section className="crmFilterBar" aria-label="Filtros do Kanban">
          <form className="crmFilterForm">
            <label>
              <span>Buscar</span>
              <div className="crmInputWithIcon">
                <input name="search" placeholder="Nome, telefone, e-mail, pedido ou evento" defaultValue={params.search || ""} />
                <ActionIcon kind="search" />
              </div>
            </label>
            <label>
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
            <label>
              <span>Periodo</span>
              <input name="period" defaultValue="01/05/2026 - 31/05/2026" />
            </label>
            <label>
              <span>Responsavel</span>
              <select name="responsible" defaultValue="">
                <option value="">Todos</option>
              </select>
            </label>
            <button className="crmPrimaryButton" type="submit">
              Atualizar Kanban
            </button>
            <Link className="crmSecondaryButton" href="/admin/crm">
              <ActionIcon kind="filter" />
              Limpar filtros
            </Link>
          </form>
        </section>

        <section className="crmKanbanViewport" aria-label="Kanban comercial">
          <div className="crmKanbanBoard">
            {board.columns.map((column) => (
              <article className={`crmKanbanColumn tone${column.id}`} key={column.id}>
                <header className="crmKanbanColumnHeader">
                  <div>
                    <h2>{column.title}</h2>
                    <p>{column.description}</p>
                  </div>
                  <span>{column.cards.length}</span>
                </header>
                <div className="crmKanbanColumnCards">
                  {column.cards.length === 0 ? (
                    <div className="crmKanbanEmpty">Nenhum card nesta etapa.</div>
                  ) : (
                    column.cards.slice(0, 8).map((card) => <KanbanCard card={card} key={card.id} />)
                  )}
                </div>
                <Link className="crmColumnMore" href={column.id === "LEAD" ? "/admin/leads" : "/admin/orders"}>
                  + {getColumnCta(column.id)}
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
