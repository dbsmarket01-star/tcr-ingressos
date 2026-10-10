import Link from "next/link";
import { SalesViewerChart } from "./SalesViewerChart";
import { AdminShell } from "./AdminShell";
import type { getDashboardMetrics } from "@/features/dashboard/dashboard.service";
import { formatCurrency } from "@/lib/format";

type Dashboard = Awaited<ReturnType<typeof getDashboardMetrics>>;
export function SalesViewerDashboard({ dashboard }: { dashboard: Dashboard }) {
  const days = dashboard.salesByDay;
  const methods = [
    { label: "Pix", ...dashboard.paymentMethods.pix, colorClass: "is-pix" },
    { label: "Cartão de crédito", ...dashboard.paymentMethods.card, colorClass: "is-card" },
    { label: "Outros", ...dashboard.paymentMethods.other, colorClass: "is-other" }
  ];
  const total = methods.reduce((sum, m) => sum + m.ticketSalesInCents, 0);
  const pixRate = total ? methods[0].ticketSalesInCents / total * 100 : 0;
  const cardRate = total ? methods[1].ticketSalesInCents / total * 100 : 0;
  const gradient = total ? `conic-gradient(var(--brand) 0% ${pixRate}%, #b8c4bf ${pixRate}% ${pixRate+cardRate}%, #dfe6e2 ${pixRate+cardRate}% 100%)` : "#dfe6e2";
  const periodLabel = `De ${dashboard.period.startDate.split("-").reverse().join("/")} a ${dashboard.period.endDate.split("-").reverse().join("/")}`;
  return <AdminShell title="Vendas" description="Acompanhe as vendas dos eventos liberados para seu acesso." hideSidebarIntro>
    <form className="card form spacedSection" method="get">
      <div className="grid twoColumns">
        <label className="field"><span>Data inicial</span><input type="date" name="startDate" defaultValue={dashboard.period.startDate} required /></label>
        <label className="field"><span>Data final</span><input type="date" name="endDate" defaultValue={dashboard.period.endDate} required /></label>
      </div>
      <button className="button" type="submit">Consultar período</button>
      <p className="muted">Para consultar um único dia, informe a mesma data nos dois campos.</p>
    </form>
    <section className="grid dashboardGrid spacedSection">
      <article className="card metric"><span>Valor dos ingressos vendidos</span><strong>{formatCurrency(dashboard.kpis.ticketSalesInCents)}</strong></article>
      <article className="card metric"><span>Ingressos vendidos</span><strong>{dashboard.kpis.paidTickets}</strong></article>
      <article className="card metric"><span>Pedidos pagos</span><strong>{dashboard.kpis.paidOrders}</strong></article>
    </section>
    <section className="dashboardGeneralMainGrid spacedSection">
      <SalesViewerChart days={days.map(({ date, label, ticketSalesInCents, paidTicketQuantity, salesCount }) => ({ date, label, ticketSalesInCents, paidTicketQuantity, salesCount }))} periodLabel={periodLabel} />
      <article className="dashboardGeneralPanel">
        <div className="dashboardGeneralPanelHeader"><div><h2>Meios de pagamento</h2><p>Composição da venda de ingressos</p></div></div>
        <div className="dashboardGeneralPaymentGrid">
          <div className="dashboardGeneralDonut" role="img" aria-label={methods.map(m => `${m.label}: ${(total ? m.ticketSalesInCents / total * 100 : 0).toFixed(1)}%`).join(", ")} style={{ background: gradient }}><span /></div>
          <div className="dashboardGeneralPaymentLegend">{methods.map(m => <div className="dashboardGeneralLegendRow" key={m.label}><div><i className={m.colorClass} /><span>{m.label}</span></div><strong>{formatCurrency(m.ticketSalesInCents)}</strong><small>{(total ? m.ticketSalesInCents / total * 100 : 0).toLocaleString("pt-BR", {maximumFractionDigits:1})}%</small></div>)}</div>
        </div>
        {!total ? <p className="muted">Nenhuma venda no período selecionado.</p> : null}
        <div className="dashboardGeneralTotalsFooter"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
      </article>
    </section>
    <section className="card spacedSection">
      <h2>Vendas por evento no período</h2>
      <div className="adminTableWrap"><table className="table">
        <thead><tr><th>Evento</th><th>Ingressos vendidos</th><th>Pedidos pagos</th><th>Valor dos ingressos</th></tr></thead>
        <tbody>{dashboard.eventSales.map(event => <tr key={event.id}>
          <td><Link href={`/admin/orders?eventId=${event.id}&startDate=${dashboard.period.startDate}&endDate=${dashboard.period.endDate}&status=PAID`}>{event.title}</Link></td>
          <td>{event.ticketQuantity}</td><td>{event.paidOrders}</td><td>{formatCurrency(event.ticketSalesInCents)}</td>
        </tr>)}</tbody>
      </table></div>
      {!dashboard.eventSales.length ? <p className="muted">Nenhum evento disponível para este acesso.</p> : null}
    </section>
    <section className="card spacedSection">
      <h2>Vendas diárias no período</h2>
      <div className="adminTableWrap"><table className="table"><thead><tr><th>Dia</th><th>Ingressos (R$)</th><th>Quantidade</th></tr></thead>
        <tbody>{days.map(day => <tr key={day.date}><td>{day.label}</td><td>{formatCurrency(day.ticketSalesInCents)}</td><td>{day.paidTicketQuantity}</td></tr>)}</tbody>
      </table></div>
      <Link className="button" href={`/admin/orders?startDate=${dashboard.period.startDate}&endDate=${dashboard.period.endDate}&status=PAID`}>Consultar pedidos e filtrar por evento</Link>
    </section>
  </AdminShell>;
}
