import Link from "next/link";
import { AdminShell } from "./AdminShell";
import type { getDashboardMetrics } from "@/features/dashboard/dashboard.service";
import { formatCurrency } from "@/lib/format";

type Dashboard = Awaited<ReturnType<typeof getDashboardMetrics>>;
export function SalesViewerDashboard({ dashboard }: { dashboard: Dashboard }) {
  const days = dashboard.salesByDay;
  const peak = Math.max(0, ...days.map(day => day.ticketSalesInCents));
  const max = Math.max(1, peak);
  const points = days.map((day, i) => `${40 + (days.length > 1 ? i / (days.length - 1) : 0.5) * 620},${190 - day.ticketSalesInCents / max * 150}`).join(" ");
  const methods = [
    { label: "Pix", count: dashboard.paymentMethods.pix.count, color: "#179b72" },
    { label: "Cartão de crédito", count: dashboard.paymentMethods.card.count, color: "#3975d7" },
    { label: "Outros", count: dashboard.paymentMethods.other.count, color: "#a5adba" }
  ];
  const total = methods.reduce((sum, m) => sum + m.count, 0);
  let offset = 0;
  const gradient = methods.map(m => { const start = offset; offset += total ? m.count / total * 100 : 0; return `${m.color} ${start}% ${offset}%`; }).join(", ");
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
    <section className="grid twoColumns spacedSection">
      <article className="card">
        <h2>Evolução diária das vendas</h2><p className="muted">Valor dos ingressos em cada dia do período.</p>
        <svg viewBox="0 0 700 240" role="img" aria-label="Gráfico diário do valor dos ingressos vendidos; valores detalhados na tabela abaixo" style={{ width: "100%", height: "auto" }}>
          {[40, 90, 140, 190].map(y => <line key={y} x1="40" x2="660" y1={y} y2={y} stroke="#e1e9e5" />)}
          <text x="40" y="25" fontSize="12" fill="#476258">{formatCurrency(peak)}</text>
          <polyline points={points} fill="none" stroke="#179b72" strokeWidth="3" strokeLinejoin="round" />
          {days.map((day, i) => <circle key={day.date} cx={40 + (days.length > 1 ? i / (days.length - 1) : 0.5) * 620} cy={190 - day.ticketSalesInCents / max * 150} r="3" fill="#179b72"><title>{`${day.label}: ${formatCurrency(day.ticketSalesInCents)}`}</title></circle>)}
          <text x="40" y="220" fontSize="12" fill="#476258">{days[0]?.label}</text><text x="660" y="220" textAnchor="end" fontSize="12" fill="#476258">{days.at(-1)?.label}</text>
        </svg>
      </article>
      <article className="card">
        <h2>Formas de pagamento</h2><p className="muted">Participação na quantidade de pedidos pagos do período.</p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24, padding: "16px 0" }}>
          <div role="img" aria-label={total ? methods.map(m => `${m.label}: ${(m.count / total * 100).toFixed(1)}%`).join(", ") : "Nenhum pedido pago no período"} style={{ width: 180, height: 180, flexShrink: 0, borderRadius: "50%", background: total ? `conic-gradient(${gradient})` : "#e1e9e5" }} />
          <ul style={{ listStyle: "none", padding: 0 }}>{methods.map(m => <li key={m.label} style={{ marginBottom: 14 }}><span aria-hidden="true" style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: m.color, marginRight: 8 }} /><strong>{m.label}</strong><br />{m.count} pedidos · {(total ? m.count / total * 100 : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</li>)}</ul>
        </div>
        {!total ? <p className="muted">Nenhuma venda no período selecionado.</p> : null}
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
