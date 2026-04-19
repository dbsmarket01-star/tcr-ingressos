import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getDashboardMetrics } from "@/features/dashboard/dashboard.service";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getPublicEventUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

const eventStatusLabels = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  UNPUBLISHED: "Despublicado",
  FINISHED: "Encerrado",
  CANCELED: "Cancelado"
};

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildPeriodPreset(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function buildCurrentMonthPreset() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function periodHref(period: { startDate: string; endDate: string }) {
  return `/admin?startDate=${period.startDate}&endDate=${period.endDate}`;
}

function formatPeriodDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00-03:00`));
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requirePermission("DASHBOARD");
  const params = searchParams ? await searchParams : {};
  const startDate = getParamValue(params.startDate);
  const endDate = getParamValue(params.endDate);
  const dashboard = await getDashboardMetrics({ startDate, endDate });
  const oneDay = buildPeriodPreset(1);
  const sevenDays = buildPeriodPreset(7);
  const thirtyDays = buildPeriodPreset(30);
  const currentMonth = buildCurrentMonthPreset();
  const customerTotal =
    dashboard.periodMetrics.newCustomerOrders + dashboard.periodMetrics.returningCustomerOrders;
  const pixRate = dashboard.periodMetrics.paymentMethods.pix.rate;
  const cardRate = dashboard.periodMetrics.paymentMethods.card.rate;
  const otherRate = dashboard.periodMetrics.paymentMethods.other.rate;

  return (
    <AdminShell
      title="Dashboard"
      description="Analise vendas, faturamento, meios de pagamento e comportamento de clientes por periodo."
    >
      <section className="dashboardFilterPanel" aria-label="Filtro do dashboard">
        <div>
          <span className="eyebrow">Vendas no periodo</span>
          <h2>Resumo comercial</h2>
          <p>
            De {formatPeriodDate(dashboard.period.startDate)} ate{" "}
            {formatPeriodDate(dashboard.period.endDate)}. Altere as datas abaixo para analisar
            outro intervalo.
          </p>
        </div>

        <form className="dashboardDateForm" method="get">
          <label>
            <span>Inicio</span>
            <input name="startDate" type="date" defaultValue={dashboard.period.startDate} />
          </label>
          <label>
            <span>Fim</span>
            <input name="endDate" type="date" defaultValue={dashboard.period.endDate} />
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
        </form>

        <div className="dashboardQuickFilters" aria-label="Atalhos de periodo">
          <Link className="secondaryButton smallButton" href={periodHref(oneDay)}>
            Hoje
          </Link>
          <Link className="secondaryButton smallButton" href={periodHref(sevenDays)}>
            7 dias
          </Link>
          <Link className="secondaryButton smallButton" href={periodHref(thirtyDays)}>
            30 dias
          </Link>
          <Link className="secondaryButton smallButton" href={periodHref(currentMonth)}>
            Mes atual
          </Link>
        </div>
      </section>

      <section className="grid dashboardGrid dashboardPrimaryGrid" aria-label="Metricas de vendas do periodo">
        <div className="card metric dashboardHeroMetric">
          <span className="muted">Total faturado no periodo selecionado</span>
          <strong>{formatCurrency(dashboard.totals.revenueInCents)}</strong>
          <small>Pagamentos aprovados dentro do filtro atual</small>
        </div>
        <div className="card metric">
          <span className="muted">Ticket medio</span>
          <strong>{formatCurrency(dashboard.periodMetrics.averageTicketInCents)}</strong>
          <small>Media por pedido aprovado</small>
        </div>
        <div className="card metric">
          <span className="muted">Pedidos vendidos</span>
          <strong>{dashboard.totals.paidOrders}</strong>
          <small>{dashboard.periodMetrics.approvedRate}% dos pedidos criados</small>
        </div>
        <div className="card metric">
          <span className="muted">Clientes unicos</span>
          <strong>{dashboard.periodMetrics.uniqueCustomers}</strong>
          <small>{dashboard.periodMetrics.newCustomerRate}% novos compradores</small>
        </div>
      </section>

      <section className="dashboardInsightsGrid" aria-label="Detalhamento de vendas">
        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Meios de pagamento</h2>
              <p>Distribuicao dos pedidos aprovados.</p>
            </div>
          </div>
          <div
            className="donutChart"
            style={{
              background: `conic-gradient(#0f7c62 0 ${pixRate}%, #18324a ${pixRate}% ${
                pixRate + cardRate
              }%, #a9b7c2 ${pixRate + cardRate}% ${pixRate + cardRate + otherRate}%, #eef2f5 0)`
            }}
            aria-hidden="true"
          />
          <div className="chartLegend">
            <div>
              <span className="legendDot pixDot" />
              <strong>Pix</strong>
              <small>
                {dashboard.periodMetrics.paymentMethods.pix.count} pedido(s) ·{" "}
                {formatCurrency(dashboard.periodMetrics.paymentMethods.pix.revenueInCents)}
              </small>
            </div>
            <div>
              <span className="legendDot cardDot" />
              <strong>Cartao</strong>
              <small>
                {dashboard.periodMetrics.paymentMethods.card.count} pedido(s) ·{" "}
                {formatCurrency(dashboard.periodMetrics.paymentMethods.card.revenueInCents)}
              </small>
            </div>
            {dashboard.periodMetrics.paymentMethods.other.count > 0 ? (
              <div>
                <span className="legendDot otherDot" />
                <strong>Outros</strong>
                <small>{dashboard.periodMetrics.paymentMethods.other.count} pedido(s)</small>
              </div>
            ) : null}
          </div>
        </div>

        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Clientes</h2>
              <p>Novos compradores versus retornos no periodo.</p>
            </div>
          </div>
          <div className="stackedBar" aria-label={`${dashboard.periodMetrics.newCustomerRate}% novos clientes`}>
            <span style={{ width: `${dashboard.periodMetrics.newCustomerRate}%` }} />
          </div>
          <div className="chartLegend">
            <div>
              <span className="legendDot pixDot" />
              <strong>Novos</strong>
              <small>
                {dashboard.periodMetrics.newCustomerOrders} pedido(s) ·{" "}
                {dashboard.periodMetrics.newCustomerRate}%
              </small>
            </div>
            <div>
              <span className="legendDot cardDot" />
              <strong>Recorrentes</strong>
              <small>
                {dashboard.periodMetrics.returningCustomerOrders} pedido(s) ·{" "}
                {dashboard.periodMetrics.returningCustomerRate}%
              </small>
            </div>
          </div>
          <div className="dashboardNote">
            Base: {customerTotal} pedido(s) aprovado(s) com cliente identificado.
          </div>
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
                        <Link className="secondaryButton smallButton" href={getPublicEventUrl(event.slug)}>
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

      <section className="grid dashboardGrid secondaryMetrics" aria-label="Indicadores operacionais">
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
          <span className="muted">Check-ins aprovados</span>
          <strong>{dashboard.totals.checkInsApproved}</strong>
        </div>
      </section>
    </AdminShell>
  );
}
