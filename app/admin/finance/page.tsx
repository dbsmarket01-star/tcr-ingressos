import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getFinanceReport } from "@/features/finance/finance-report.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type FinancePageProps = {
  searchParams: Promise<{
    eventId?: string;
    lotId?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
  }>;
};

const methodLabels = {
  PIX: "Pix",
  CREDIT_CARD: "Cartao",
  SIMULATED: "Simulado",
  OTHER: "Outros"
};

const methodFilterLabels = {
  PIX: "Pix",
  CREDIT_CARD: "Cartao de credito",
  SIMULATED: "Simulado",
  OTHER: "Outros"
};

type IconName = "calendar" | "download" | "filter" | "search" | "ticket" | "chart" | "wallet" | "average" | "users" | "card" | "history" | "source" | "site";

function FinanceIcon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.9,
    viewBox: "0 0 24 24"
  };

  const paths: Record<IconName, ReactNode> = {
    average: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15l3-4 3 2 4-6" /></>,
    calendar: <><rect height="17" rx="2" width="18" x="3" y="4" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>,
    card: <><rect height="14" rx="2" width="18" x="3" y="5" /><path d="M3 10h18" /><path d="M7 15h3" /></>,
    chart: <><path d="M4 19V5" /><rect height="7" rx="1" width="3" x="7" y="12" /><rect height="11" rx="1" width="3" x="12" y="8" /><rect height="15" rx="1" width="3" x="17" y="4" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    filter: <><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 5v5h5" /><path d="M12 7v5l3 2" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    site: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /><path d="M8 4v16" /><path d="M16 4v16" /></>,
    source: <><path d="M4 17V7a2 2 0 0 1 2-2h5" /><path d="M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6" /><path d="m13 9 3 3-3 3" /><path d="M8 12h8" /></>,
    ticket: <><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" /><path d="M13 6v12" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    wallet: <><path d="M20 7H5a2 2 0 0 0 0 4h15v8H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h13Z" /><path d="M16 14h.01" /></>
  };

  return <svg aria-hidden="true" {...common}>{paths[name]}</svg>;
}

function formatLotDisplayName(lotName: string, optionLabel?: string | null) {
  return optionLabel ? `${lotName} - ${optionLabel}` : lotName;
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function buildQuery(filters: Record<string, string>) {
  return new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value)))).toString();
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const admin = await requirePermission("FINANCE");
  const organizationContext = await getCurrentOrganizationContext();
  const params = await searchParams;
  const report = await getFinanceReport(params, admin.organizationId, getAdminAllowedEventIds(admin));
  const selectedLot = report.lots.find((lot) => lot.id === report.filters.lotId);
  const exportParams = buildQuery({
    eventId: report.filters.eventId,
    lotId: report.filters.lotId,
    paymentMethod: report.filters.paymentMethod,
    startDate: report.filters.startDate,
    endDate: report.filters.endDate
  });
  const exportHref = `/admin/finance/export?${exportParams}`;
  const exportPdfHref = `/admin/finance/export/pdf?${exportParams}`;
  const averageTicketInCents = report.totals.paidOrders > 0
    ? Math.round(report.totals.grossRevenueInCents / report.totals.paidOrders)
    : 0;
  const totalMethodOrders = report.byMethod.reduce((sum, row) => sum + row.count, 0);
  const methodStats = (["PIX", "CREDIT_CARD", "OTHER"] as const).map((method) => {
    const row = method === "OTHER"
      ? report.byMethod.filter((item) => item.method === "OTHER" || item.method === "SIMULATED").reduce(
        (acc, item) => ({ count: acc.count + item.count, grossInCents: acc.grossInCents + item.grossInCents }),
        { count: 0, grossInCents: 0 }
      )
      : report.byMethod.find((item) => item.method === method) ?? { count: 0, grossInCents: 0 };

    return {
      colorClass: method === "PIX" ? "is-pix" : method === "CREDIT_CARD" ? "is-card" : "is-other",
      label: methodLabels[method],
      count: row.count,
      rate: percentage(row.count, totalMethodOrders)
    };
  });
  const pixRate = methodStats[0]?.rate ?? 0;
  const cardRate = methodStats[1]?.rate ?? 0;
  const paymentChart = `conic-gradient(
    var(--admin-primary, #065f46) 0deg ${(pixRate / 100) * 360}deg,
    #2fb36d ${(pixRate / 100) * 360}deg ${((pixRate + cardRate) / 100) * 360}deg,
    #dfe6e2 ${((pixRate + cardRate) / 100) * 360}deg 360deg
  )`;
  const maxSourceOrders = Math.max(...report.bySource.map((row) => row.count), 1);
  const publicSiteHref = organizationContext.publicBaseUrl;

  return (
    <AdminShell
      title="Venda de ingressos"
      description="Acompanhe suas vendas, pagamentos e faturamento em tempo real."
    >
      <section className="financeDashboardTopbar" aria-label="Resumo da operacao">
        <div className="financeDashboardIdentity">
          <span className="financeDashboardAvatar">{admin.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{admin.name}</strong>
            <small>{admin.role}</small>
          </div>
        </div>
        <div className="financeDashboardOperation">
          <span><i /> Operacao em andamento</span>
          <small>{organizationContext.brandName} opera com dominio, equipe e rotina proprios.</small>
          <a className="secondaryButton smallButton" href={publicSiteHref} target="_blank" rel="noreferrer">
            Ver site
          </a>
        </div>
      </section>

      <section className="card financeDashboardFilters">
        <form className="financeDashboardFilterForm">
          <label className="field financeDateRangeField">
            <span>Periodo</span>
            <div className="financeDateRangeInputs">
              <FinanceIcon name="calendar" />
              <input type="date" name="startDate" defaultValue={report.filters.startDate} />
              <b>ate</b>
              <input type="date" name="endDate" defaultValue={report.filters.endDate} />
            </div>
          </label>
          <label className="field">
            <span>Evento</span>
            <select name="eventId" defaultValue={report.filters.eventId}>
              <option value="">Todos os eventos</option>
              {report.events.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Area / Setor</span>
            <select name="lotId" defaultValue={report.filters.lotId}>
              <option value="">Todas as areas</option>
              {report.lots.map((lot) => (
                <option value={lot.id} key={lot.id}>
                  {report.filters.eventId ? lot.name : `${lot.event.title} - ${lot.name}`}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Forma de pagamento</span>
            <select name="paymentMethod" defaultValue={report.filters.paymentMethod}>
              <option value="">Todas</option>
              {Object.entries(methodFilterLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <Link className="secondaryButton financeIconButton" href="/admin/finance">
            <FinanceIcon name="filter" />
            Filtros
          </Link>
          <button className="button financeIconButton" type="submit">
            <FinanceIcon name="search" />
            Filtrar
          </button>
          <Link className="button financePdfButton" href={exportPdfHref}>
            <FinanceIcon name="download" />
            <span>
              Baixar PDF
              <small>Relatorio do periodo</small>
            </span>
          </Link>
        </form>
      </section>

      <section className="financeDashboardKpis" aria-label="Indicadores financeiros">
        <article className="card financeKpiCard">
          <span className="financeKpiIcon"><FinanceIcon name="ticket" /></span>
          <div>
            <small>Vendas confirmadas</small>
            <strong>{report.totals.paidOrders}</strong>
            <p>Pedidos pagos no periodo</p>
          </div>
        </article>
        <article className="card financeKpiCard">
          <span className="financeKpiIcon"><FinanceIcon name="chart" /></span>
          <div>
            <small>Faturamento bruto</small>
            <strong>{formatCurrency(report.totals.grossRevenueInCents)}</strong>
            <p>Valor total dos pedidos</p>
          </div>
        </article>
        <article className="card financeKpiCard">
          <span className="financeKpiIcon"><FinanceIcon name="average" /></span>
          <div>
            <small>Ticket medio</small>
            <strong>{formatCurrency(averageTicketInCents)}</strong>
            <p>Media por pedido pago</p>
          </div>
        </article>
        <article className="card financeKpiCard">
          <span className="financeKpiIcon"><FinanceIcon name="users" /></span>
          <div>
            <small>Ingressos vendidos</small>
            <strong>{report.totals.ticketsIssued}</strong>
            <p>Unidades vendidas</p>
          </div>
        </article>
        <article className="card financeKpiCard">
          <span className="financeKpiIcon"><FinanceIcon name="card" /></span>
          <div>
            <small>Taxas recebidas</small>
            <strong>{formatCurrency(report.totals.serviceFeeInCents)}</strong>
            <p>Taxa de sistema faturada</p>
          </div>
        </article>
      </section>

      {selectedLot ? (
        <p className="financeDashboardActiveFilter">
          Area / setor filtrado: <strong>{selectedLot.name}</strong> em {selectedLot.event.title}
        </p>
      ) : null}

      <section className="financeDashboardMainGrid">
        <article className="card financeDashboardPanel">
          <div className="financeDashboardPanelHeader">
            <div>
              <span><FinanceIcon name="history" /></span>
              <h2>Historico de vendas recente</h2>
            </div>
          </div>
          {report.recentPaidOrders.length === 0 ? (
            <div className="empty">Nenhuma venda confirmada nesse recorte.</div>
          ) : (
            <div className="tableScroll">
              <table className="table financeDashboardTable">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Data</th>
                    <th>Comprador</th>
                    <th>Evento</th>
                    <th>Area / Setor</th>
                    <th>Ingresso</th>
                    <th>Total</th>
                    <th>Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {report.recentPaidOrders.slice(0, 5).map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link href={`/admin/orders/${order.code}`}>{order.code.replace(/^ING-/, "")}</Link>
                      </td>
                      <td>{formatDateTime(order.paidAt ?? order.createdAt)}</td>
                      <td>{order.customer.name}</td>
                      <td>{order.event.title}</td>
                      <td>
                        {Array.from(new Set(order.items.map((item) => item.lot.name))).join(", ")}
                      </td>
                      <td>
                        {Array.from(new Set(order.items.map((item) => formatLotDisplayName(item.lot.name, item.lotOption?.label)))).join(", ")}
                      </td>
                      <td>{formatCurrency(order.totalInCents)}</td>
                      <td><span className="status published">Sim</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="financeDashboardPanelAction">
            <Link className="secondaryButton smallButton" href="/admin/orders">
              Ver todos os pedidos <span aria-hidden="true">{"->"}</span>
            </Link>
          </div>
        </article>

        <article className="card financeDashboardPanel">
          <div className="financeDashboardPanelHeader">
            <div>
              <span><FinanceIcon name="wallet" /></span>
              <h2>Formas de pagamento</h2>
            </div>
          </div>
          <div className="financePaymentPanel">
            <div className="financePaymentDonut" style={{ background: paymentChart }}>
              <span>
                <strong>{totalMethodOrders}</strong>
                pedidos
              </span>
            </div>
            <div className="financePaymentLegend">
              {methodStats.map((item) => (
                <div className="financePaymentLegendRow" key={item.label}>
                  <div>
                    <i className={item.colorClass} />
                    <strong>{item.label}</strong>
                    <small>{item.count} pedidos</small>
                  </div>
                  <span>{formatPercent(item.rate)}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="financeDashboardBottomGrid">
        <article className="card financeDashboardPanel">
          <div className="financeDashboardPanelHeader">
            <div>
              <span><FinanceIcon name="chart" /></span>
              <h2>Faturamento por evento</h2>
            </div>
          </div>
          {report.byEvent.length === 0 ? (
            <div className="empty">Nenhum faturamento confirmado no periodo.</div>
          ) : (
            <div className="tableScroll">
              <table className="table financeDashboardEventTable">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Pedidos pagos</th>
                    <th>Ingressos</th>
                    <th>Bruto</th>
                    <th>Taxas</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byEvent.slice(0, 6).map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{row.count}</td>
                      <td>{row.tickets}</td>
                      <td>{formatCurrency(row.grossInCents)}</td>
                      <td>{formatCurrency(row.serviceFeeInCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="financeDashboardPanelAction">
            <Link className="secondaryButton smallButton" href={exportHref}>
              Ver todos os eventos <span aria-hidden="true">{"->"}</span>
            </Link>
          </div>
        </article>

        <article className="card financeDashboardPanel">
          <div className="financeDashboardPanelHeader">
            <div>
              <span><FinanceIcon name="source" /></span>
              <h2>Origem das vendas</h2>
            </div>
          </div>
          {report.bySource.length === 0 ? (
            <div className="empty">Nenhuma origem registrada no periodo.</div>
          ) : (
            <div className="financeSourceList">
              {report.bySource.slice(0, 5).map((row, index) => {
                const rate = percentage(row.count, report.totals.paidOrders);
                const width = Math.max(4, percentage(row.count, maxSourceOrders));

                return (
                  <div className="financeSourceRow" key={row.source}>
                    <span>{row.source}</span>
                    <div><i style={{ width: `${width}%` }} data-rank={index} /></div>
                    <strong>{row.count} pedidos</strong>
                    <em>{formatPercent(rate)}</em>
                  </div>
                );
              })}
            </div>
          )}
          <div className="financeDashboardPanelAction">
            <Link className="secondaryButton smallButton" href={exportPdfHref}>
              Ver relatorio completo <span aria-hidden="true">{"->"}</span>
            </Link>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
