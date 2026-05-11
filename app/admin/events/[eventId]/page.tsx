import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { CopyButton } from "@/components/forms/CopyButton";
import { countEventPageVisits } from "@/features/analytics/page-visit.service";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { duplicateEventAction, updateEventStatusAction } from "@/features/events/event.actions";
import { getEventCapacity, getEventForManagement, getEventRevenueInCents } from "@/features/events/event.service";
import { getLeadOriginBucket } from "@/features/tracking/tracking";
import { formatCurrency } from "@/lib/format";
import { getPublicEventUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

type EventManagementPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels = {
  DRAFT: "Em preparação",
  PUBLISHED: "Publicado",
  UNPUBLISHED: "Pausado",
  FINISHED: "Encerrado",
  CANCELED: "Cancelado"
} as const;

function formatEventDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function formatEventTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function getStatusClass(status: keyof typeof statusLabels) {
  if (status === "PUBLISHED") return "published";
  if (status === "DRAFT" || status === "UNPUBLISHED") return "pending";
  if (status === "FINISHED") return "draft";
  return "canceled";
}

function percentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(2));
}

function formatPercentage(value: number, fractionDigits = 2) {
  return `${value.toFixed(fractionDigits).replace(".", ",")}%`;
}

function getDaysUntil(startsAt: Date) {
  const now = new Date();
  const midnightNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const midnightEvent = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate()).getTime();
  return Math.max(0, Math.ceil((midnightEvent - midnightNow) / 86400000));
}

function buildDailySeries(
  orders: Array<{ paidAt: Date | null; totalInCents: number; payment: { amountInCents: number } | null }>,
  days = 30
) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const rows = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      date,
      label: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo"
      }).format(date),
      revenueInCents: 0,
      salesCount: 0
    };
  });

  const indexByKey = new Map(rows.map((row, index) => [row.key, index]));

  for (const order of orders) {
    const paidAt = order.paidAt ?? null;
    if (!paidAt) continue;
    const key = paidAt.toISOString().slice(0, 10);
    const index = indexByKey.get(key);
    if (index === undefined) continue;
    rows[index].salesCount += 1;
    rows[index].revenueInCents += order.payment?.amountInCents ?? order.totalInCents;
  }

  return rows;
}

function buildSeriesPath(values: number[], width: number, height: number) {
  const paddingLeft = 18;
  const paddingRight = 18;
  const paddingTop = 16;
  const paddingBottom = 24;
  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...values, 1);

  const points = values.map((value, index) => {
    const x = paddingLeft + (usableWidth * index) / Math.max(1, values.length - 1);
    const y = paddingTop + usableHeight - (value / maxValue) * usableHeight;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(height - paddingBottom).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - paddingBottom).toFixed(1)} Z`
      : "";

  return { points, linePath, areaPath };
}

function summarizeLeadOrigins(
  leads: Array<{ utmSource: string | null; utmMedium: string | null }>,
  totalLeads: number
) {
  const buckets = new Map<string, number>();

  for (const lead of leads) {
    const label = getLeadOriginBucket(lead.utmSource, lead.utmMedium);
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([label, count]) => ({
      label,
      count,
      rate: percentage(count, totalLeads)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

function DashboardIcon({
  kind
}: {
  kind:
    | "ticket"
    | "money"
    | "chart"
    | "target"
    | "users"
    | "calendar"
    | "signal"
    | "flash"
    | "megaphone"
    | "check"
    | "leads"
    | "spark";
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  if (kind === "ticket") {
    return (
      <svg {...common}>
        <path d="M4 9a2.5 2.5 0 0 0 0 6v3h16v-3a2.5 2.5 0 0 0 0-6V6H4z" />
        <path d="M9 8v8" />
      </svg>
    );
  }

  if (kind === "money") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8" />
        <path d="M15 10.5c0-1.2-1.34-2.18-3-2.18s-3 .98-3 2.18 1.34 2.18 3 2.18 3 .98 3 2.18-1.34 2.18-3 2.18-3-.98-3-2.18" />
      </svg>
    );
  }

  if (kind === "chart") {
    return (
      <svg {...common}>
        <path d="M6 18V9" />
        <path d="M12 18V6" />
        <path d="M18 18v-4" />
      </svg>
    );
  }

  if (kind === "target") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  if (kind === "users") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7.5" r="3.5" />
        <path d="M17 11a3 3 0 1 0 0-6" />
      </svg>
    );
  }

  if (kind === "calendar") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </svg>
    );
  }

  if (kind === "signal") {
    return (
      <svg {...common}>
        <path d="M5 18V9" />
        <path d="M10 18V6" />
        <path d="M15 18v-4" />
        <path d="M20 18v-8" />
      </svg>
    );
  }

  if (kind === "flash") {
    return (
      <svg {...common}>
        <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8Z" />
      </svg>
    );
  }

  if (kind === "megaphone") {
    return (
      <svg {...common}>
        <path d="M3 11v2a2 2 0 0 0 2 2h2l4 4V5L7 9H5a2 2 0 0 0-2 2Z" />
        <path d="M15 9a4 4 0 0 1 0 6" />
      </svg>
    );
  }

  if (kind === "check") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12.5 2.2 2.2 4.8-5.2" />
      </svg>
    );
  }

  if (kind === "leads") {
    return (
      <svg {...common}>
        <path d="M12 4v16" />
        <path d="M4 12h16" />
        <path d="m7 7 10 10" />
        <path d="M17 7 7 17" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M6 18c2.5-1.5 4-4.5 4.5-8 1.5 2 3 3.5 5.5 4.5" />
      <path d="M5 10c2.5-.5 4.5-1.5 6-3.5 1.5 2 3.5 3 6 3.5" />
    </svg>
  );
}

export default async function EventManagementPage({ params, searchParams }: EventManagementPageProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  await requireEventAccess(eventId);
  const query = searchParams ? await searchParams : {};
  const [event, leadCaptureVisits, publicEventVisits] = await Promise.all([
    getEventForManagement(eventId, admin.organizationId!, getAdminAllowedEventIds(admin)),
    countEventPageVisits(eventId, "LEAD_CAPTURE"),
    countEventPageVisits(eventId, "PUBLIC_EVENT")
  ]);

  if (!event) {
    notFound();
  }

  const capacity = getEventCapacity(event);
  const revenueInCents = getEventRevenueInCents(event);
  const paidOrders = event.orders;
  const leads = event.leads;
  const totalLeads = event._count.leads;
  const soldTickets = capacity.sold;
  const activeLots = event.lots.filter((lot) => lot.status === "ACTIVE").length;
  const availableTickets = Math.max(capacity.total - capacity.sold - capacity.reserved, 0);
  const averageTicketInCents = paidOrders.length > 0 ? Math.round(revenueInCents / paidOrders.length) : 0;
  const conversionRate = percentage(paidOrders.length, totalLeads);
  const daysUntilEvent = getDaysUntil(event.startsAt);
  const viewsToThankYou = leads.filter((lead) => lead.thankYouViewedAt).length;
  const whatsappClicks = leads.reduce((sum, lead) => sum + lead.whatsappClickCount, 0);
  const leadCaptureConversionRate = percentage(totalLeads, leadCaptureVisits);
  const salesLast24h = paidOrders.filter((order) => {
    const paidAt = order.paidAt ?? null;
    return paidAt ? Date.now() - paidAt.getTime() <= 86400000 : false;
  }).length;
  const salesSeries = buildDailySeries(
    paidOrders.map((order) => ({
      paidAt: order.paidAt,
      totalInCents: order.totalInCents,
      payment: order.payment
    })),
    30
  );
  const revenuePath = buildSeriesPath(
    salesSeries.map((item) => item.revenueInCents),
    700,
    300
  );
  const salesPath = buildSeriesPath(
    salesSeries.map((item) => item.salesCount),
    700,
    300
  );
  const originBreakdown = summarizeLeadOrigins(leads, Math.max(totalLeads, 1));
  const activeCoupons = event.coupons.filter((coupon) => coupon.status === "ACTIVE").slice(0, 5);
  const recentOrders = paidOrders.slice(0, 5);
  const progress = percentage(soldTickets, Math.max(capacity.total, 1));
  const quickStats = [
    {
      label: "Vendidos / total",
      value: `${soldTickets} / ${capacity.total}`,
      note: `${progress.toFixed(2).replace(".", ",")}% vendido`,
      icon: "ticket" as const
    },
    {
      label: "Faturamento",
      value: formatCurrency(revenueInCents),
      note: `${paidOrders.length} venda(s) pagas`,
      icon: "money" as const
    },
    {
      label: "Ticket médio",
      value: formatCurrency(averageTicketInCents),
      note: "Média das compras aprovadas",
      icon: "chart" as const
    },
    {
      label: "Conversão",
      value: formatPercentage(conversionRate),
      note: "Pedidos pagos sobre leads",
      icon: "target" as const
    },
    {
      label: "Leads captados",
      value: String(totalLeads),
      note: `${leadCaptureVisits} visita(s) na landing`,
      icon: "users" as const
    },
    {
      label: "Visitas ao site",
      value: String(event.leadCaptureEnabled ? leadCaptureVisits : publicEventVisits),
      note: event.leadCaptureEnabled ? "Landing de captação" : "Página pública do evento",
      icon: "calendar" as const
    }
  ];

  return (
    <AdminShell
      title={event.title}
      description="Visão geral operacional, comercial e de captação deste evento."
      headerVariant="minimal"
      hideSidebarIntro
    >
      {typeof query.eventError === "string" ? <div className="errorBox spacedSection">{query.eventError}</div> : null}
      {query.eventSaved === "1" ? <div className="successBox spacedSection">Evento atualizado com sucesso.</div> : null}

      <section className="eventOverviewShell">
        <div className="eventOverviewBreadcrumbs">
          <Link href="/admin/events">Congressos e eventos</Link>
          <span>›</span>
          <strong>{event.title}</strong>
        </div>

        <section className="eventOverviewHeroCard">
          <div className="eventOverviewHeroMain">
            <div className="eventOverviewThumb">
              {event.bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={event.title} src={event.bannerUrl} />
              ) : (
                <strong>{event.title.slice(0, 2).toUpperCase()}</strong>
              )}
            </div>

            <div className="eventOverviewHeroCopy">
              <span className={`status ${getStatusClass(event.status)}`}>{statusLabels[event.status]}</span>
              <h1>{event.title}</h1>
              <p>
                {event.city}, {event.state} <span>•</span> {formatEventDate(event.startsAt)}, {formatEventTime(event.startsAt)}
              </p>
            </div>
          </div>

          <div className="eventOverviewHeroActions">
            <Link className="secondaryButton" href={getPublicEventUrl(event.slug, event.organization)} target="_blank">
              Ver site do evento
            </Link>
            <details className="eventOverviewActionMenu">
              <summary>Ações</summary>
              <div>
                <Link href={`/admin/events/${event.id}/edit`}>Editar evento</Link>
                <form action={duplicateEventAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <button type="submit">Duplicar evento</button>
                </form>
                {event.leadCaptureEnabled ? (
                  <Link href={`/admin/events/${event.id}/leads`}>Abrir leads captados</Link>
                ) : null}
              </div>
            </details>
          </div>
        </section>

        <nav className="eventOverviewTabs" aria-label="Seções do evento">
          <span className="isActive">Visão geral</span>
          <Link href={`/admin/events/${event.id}/edit`}>Ingressos e lotes</Link>
          <Link href={event.leadCaptureEnabled ? `/admin/events/${event.id}/leads` : `/admin/events/${event.id}/edit`}>Captação</Link>
          <Link href={`/admin/finance?eventId=${event.id}`}>Financeiro</Link>
          <Link href={getPublicEventUrl(event.slug, event.organization)} target="_blank">Divulgação</Link>
          <Link href="/admin/check-in">Check-in</Link>
          <Link href={`/admin/events/${event.id}/edit`}>Configurações</Link>
        </nav>

        <section className="eventOverviewKpiGrid">
          {quickStats.map((item) => (
            <article className="eventOverviewKpiCard" key={item.label}>
              <span className="eventOverviewKpiIcon">
                <DashboardIcon kind={item.icon} />
              </span>
              <span className="eventOverviewKpiLabel">{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </section>

        <section className="eventOverviewSignalCard">
          <div className="eventOverviewSignalLead">
            <span className="eventOverviewSignalIcon">
              <DashboardIcon kind="signal" />
            </span>
            <div>
              <strong>{event.leadCaptureEnabled ? "Captação ativa" : "Captação desativada"}</strong>
              <p>{event.leadCaptureEnabled ? "O evento está recebendo leads e vendas." : "Ative a landing para captar interesse."}</p>
            </div>
          </div>
          <div className="eventOverviewSignalStats">
            <div>
              <span>Taxa de conversão</span>
              <strong>{formatPercentage(conversionRate)}</strong>
            </div>
            <div>
              <span>Vendas nas últimas 24h</span>
              <strong>{salesLast24h}</strong>
            </div>
            <div>
              <span>Lotes ativos</span>
              <strong>{activeLots}</strong>
            </div>
            <div>
              <span>Disponíveis agora</span>
              <strong>{availableTickets}</strong>
            </div>
          </div>
        </section>

        <section className="eventOverviewChartsGrid">
          <article className="eventOverviewPanel">
            <div className="eventOverviewPanelHeader">
              <div>
                <h2>Vendas e faturamento</h2>
                <p>Últimos 30 dias do evento</p>
              </div>
              <span className="eventOverviewPill">Últimos 30 dias</span>
            </div>

            <div className="eventOverviewChartLegend">
              <span><i className="isSales" /> Vendas</span>
              <span><i className="isRevenue" /> Faturamento (R$)</span>
            </div>

            <div className="eventOverviewChartWrap">
              <svg viewBox="0 0 700 300" preserveAspectRatio="none">
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = 18 + (300 - 42) * ratio;
                  return <line className="eventOverviewGridLine" key={ratio} x1="18" x2="682" y1={y} y2={y} />;
                })}
                <path className="eventOverviewAreaPath" d={revenuePath.areaPath} />
                <path className="eventOverviewRevenuePath" d={revenuePath.linePath} />
                <path className="eventOverviewSalesPath" d={salesPath.linePath} />
                {revenuePath.points.map((point, index) => (
                  <circle className="eventOverviewRevenuePoint" cx={point.x} cy={point.y} key={`revenue-${index}`} r="4.5" />
                ))}
              </svg>
              <div
                className="eventOverviewChartHotspots"
                style={{ gridTemplateColumns: `repeat(${Math.max(salesSeries.length, 1)}, minmax(0, 1fr))` }}
              >
                {salesSeries.map((item, index) => (
                  <button
                    aria-label={`${item.label}: ${item.salesCount} ingresso(s) faturado(s), ${formatCurrency(item.revenueInCents)}`}
                    className="eventOverviewChartHotspot"
                    key={`hotspot-${item.key}-${index}`}
                    type="button"
                  >
                    <span className="eventOverviewChartTooltip">
                      <strong>{item.label}</strong>
                      <small>{item.salesCount} ingresso(s) faturado(s)</small>
                      <small>{formatCurrency(item.revenueInCents)}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div
                className="eventOverviewChartAxis"
                style={{ gridTemplateColumns: `repeat(${Math.max(salesSeries.length, 1)}, minmax(0, 1fr))` }}
              >
                {salesSeries.map((item, index) => (
                  <span key={`${item.key}-${index}`}>{index % 4 === 0 || index === salesSeries.length - 1 ? item.label : ""}</span>
                ))}
              </div>
            </div>
          </article>

          <article className="eventOverviewPanel">
            <div className="eventOverviewPanelHeader">
              <div>
                <h2>Funil de vendas</h2>
                <p>{event.leadCaptureEnabled ? "Da visita ao clique no grupo" : "Da visita até a compra"}</p>
              </div>
            </div>

            <div className="eventOverviewFunnel">
              <div className="eventOverviewFunnelStep isLight">
                <span>{event.leadCaptureEnabled ? "Visitas ao site" : "Visitas ao site"}</span>
                <strong>{event.leadCaptureEnabled ? leadCaptureVisits : publicEventVisits}</strong>
              </div>
              <div className="eventOverviewFunnelStep isMid">
                <span>{event.leadCaptureEnabled ? "Cadastros" : "Iniciaram compra"}</span>
                <strong>{event.leadCaptureEnabled ? totalLeads : paidOrders.length}</strong>
              </div>
              <div className="eventOverviewFunnelStep isDark">
                <span>{event.leadCaptureEnabled ? "Clique no grupo" : "Compraram"}</span>
                <strong>{event.leadCaptureEnabled ? whatsappClicks : paidOrders.length}</strong>
              </div>
            </div>

            <div className="eventOverviewFunnelMeta">
              <div>
                <span>{event.leadCaptureEnabled ? "Conversão visita -> cadastro" : "Conversão geral"}</span>
                <strong>{formatPercentage(event.leadCaptureEnabled ? leadCaptureConversionRate : conversionRate)}</strong>
              </div>
              <div>
                <span>{event.leadCaptureEnabled ? "Obrigado visto" : "Dias para o evento"}</span>
                <strong>{event.leadCaptureEnabled ? viewsToThankYou : `${daysUntilEvent}`}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="eventOverviewPanel">
          <div className="eventOverviewPanelHeader">
            <div>
              <h2>Ações rápidas</h2>
              <p>Atalhos do dia a dia para tocar o evento.</p>
            </div>
          </div>

          <div className="eventOverviewQuickActions">
            <form action={updateEventStatusAction} className="eventOverviewQuickAction">
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="eventSlug" value={event.slug} />
              <input type="hidden" name="status" value="PUBLISHED" />
              <span className="eventOverviewQuickIcon"><DashboardIcon kind="flash" /></span>
              <div>
                <strong>Ativar vendas públicas</strong>
                <small>Deixar o evento visível</small>
              </div>
              <button className="button smallButton" type="submit">Ativar</button>
            </form>

            <form action={updateEventStatusAction} className="eventOverviewQuickAction">
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="eventSlug" value={event.slug} />
              <input type="hidden" name="status" value="UNPUBLISHED" />
              <span className="eventOverviewQuickIcon"><DashboardIcon kind="check" /></span>
              <div>
                <strong>Pausar vendas</strong>
                <small>Ocultar compra por enquanto</small>
              </div>
              <button className="secondaryButton smallButton" type="submit">Pausar</button>
            </form>

            <Link className="eventOverviewQuickAction" href={getPublicEventUrl(event.slug, event.organization)} target="_blank">
              <span className="eventOverviewQuickIcon"><DashboardIcon kind="ticket" /></span>
              <div>
                <strong>Abrir checkout</strong>
                <small>Visualizar página de compra</small>
              </div>
              <span className="eventOverviewQuickLink">Abrir</span>
            </Link>

            <div className="eventOverviewQuickAction">
              <span className="eventOverviewQuickIcon"><DashboardIcon kind="megaphone" /></span>
              <div>
                <strong>Copiar link do evento</strong>
                <small>Compartilhar com a equipe</small>
              </div>
              <CopyButton className="secondaryButton smallButton" copiedLabel="Copiado" label="Copiar" value={getPublicEventUrl(event.slug, event.organization)} />
            </div>

            <Link className="eventOverviewQuickAction" href={`/admin/finance?eventId=${event.id}`}>
              <span className="eventOverviewQuickIcon"><DashboardIcon kind="chart" /></span>
              <div>
                <strong>Ver relatório completo</strong>
                <small>Financeiro, pedidos e vendas</small>
              </div>
              <span className="eventOverviewQuickLink">Abrir</span>
            </Link>
          </div>
        </section>

        <section className="eventOverviewDualGrid">
          <article className="eventOverviewPanel">
            <div className="eventOverviewPanelHeader">
              <div>
                <h2>Cupons ativos</h2>
                <p>
                  {event.couponsEnabled
                    ? "Campo de cupom habilitado no checkout deste evento."
                    : "Campo de cupom oculto no checkout. Ative na edição do evento quando quiser usar."}
                </p>
              </div>
              <Link className="eventOverviewGhostLink" href={`/admin/events/${event.id}/edit`}>
                Ver todos
              </Link>
            </div>

            {activeCoupons.length === 0 ? (
              <div className="empty">Nenhum cupom ativo neste momento.</div>
            ) : (
              <table className="table eventOverviewCompactTable">
                <thead>
                  <tr>
                    <th>Cupom</th>
                    <th>Tipo</th>
                    <th>Desconto</th>
                    <th>Usos</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCoupons.map((coupon) => (
                    <tr key={coupon.id}>
                      <td>{coupon.code}</td>
                      <td>{coupon.type === "PERCENTAGE" ? "Percentual" : "Valor fixo"}</td>
                      <td>{coupon.type === "PERCENTAGE" ? `${coupon.percentage ?? 0}%` : formatCurrency(coupon.amountInCents ?? 0)}</td>
                      <td>
                        {coupon.redeemedCount}
                        {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}
                      </td>
                      <td>
                        <span className={`status ${coupon.status === "ACTIVE" ? "published" : "draft"}`}>
                          {coupon.status === "ACTIVE" ? "Ativo" : "Pausado"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article className="eventOverviewPanel">
            <div className="eventOverviewPanelHeader">
              <div>
                <h2>Pedidos recentes</h2>
                <p>Últimas compras aprovadas deste evento.</p>
              </div>
              <Link className="eventOverviewGhostLink" href={`/admin/orders?eventId=${event.id}`}>
                Ver todos
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="empty">Nenhuma compra aprovada ainda.</div>
            ) : (
              <table className="table eventOverviewCompactTable">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Nome</th>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.code}>
                      <td>{order.code}</td>
                      <td>{order.customer.name}</td>
                      <td>{formatEventDate(order.paidAt ?? order.createdAt)}</td>
                      <td>{formatCurrency(order.payment?.amountInCents ?? order.totalInCents)}</td>
                      <td>{order.payment?.provider === "ASAAS" ? "Pix/Asaas" : order.payment?.provider ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </section>

        <section className="eventOverviewMiniGrid">
          <article className="eventOverviewMiniCard">
            <span className="eventOverviewQuickIcon"><DashboardIcon kind="check" /></span>
            <div>
              <strong>Check-in</strong>
              <p>
                {event._count.checkIns} / {soldTickets}
              </p>
              <small>{formatPercentage(percentage(event._count.checkIns, Math.max(soldTickets, 1)))} realizado</small>
            </div>
          </article>

          <article className="eventOverviewMiniCard">
            <span className="eventOverviewQuickIcon"><DashboardIcon kind="leads" /></span>
            <div>
              <strong>Captação</strong>
              <p>{totalLeads} leads</p>
              <small>{formatPercentage(percentage(viewsToThankYou, Math.max(totalLeads, 1)))} chegaram ao obrigado</small>
            </div>
          </article>

          <article className="eventOverviewMiniCard">
            <span className="eventOverviewQuickIcon"><DashboardIcon kind="spark" /></span>
            <div>
              <strong>Engajamento</strong>
              <p>{whatsappClicks} clique(s)</p>
              <small>{formatPercentage(percentage(whatsappClicks, Math.max(totalLeads, 1)))} clicaram no grupo</small>
            </div>
          </article>

          <article className="eventOverviewMiniCard">
            <span className="eventOverviewQuickIcon"><DashboardIcon kind="megaphone" /></span>
            <div>
              <strong>Origem dos leads</strong>
              <ul className="eventOverviewOriginList">
                {originBreakdown.length === 0 ? (
                  <li>Sem origem registrada</li>
                ) : (
                  originBreakdown.map((item) => (
                    <li key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.rate.toFixed(0)}%</strong>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </article>
        </section>
      </section>
    </AdminShell>
  );
}
