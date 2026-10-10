import Link from "next/link";
import { AdminShell } from "./AdminShell";
import type { getDashboardMetrics } from "@/features/dashboard/dashboard.service";
import { formatCurrency } from "@/lib/format";

type Dashboard = Awaited<ReturnType<typeof getDashboardMetrics>>;
export function SalesViewerDashboard({ dashboard }: { dashboard: Dashboard }) {
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
      <article className="card metric"><span>Total pago com taxas</span><strong>{formatCurrency(dashboard.kpis.revenueInCents)}</strong></article>
      <article className="card metric"><span>Ingressos vendidos</span><strong>{dashboard.kpis.paidTickets}</strong></article>
      <article className="card metric"><span>Pedidos pagos</span><strong>{dashboard.kpis.paidOrders}</strong></article>
    </section>
    <section className="card spacedSection">
      <h2>Vendas diárias no período</h2>
      <div className="adminTableWrap"><table className="table"><thead><tr><th>Dia</th><th>Ingressos (R$)</th><th>Total pago</th></tr></thead>
        <tbody>{dashboard.salesByDay.map(day => <tr key={day.date}><td>{day.label}</td><td>{formatCurrency(day.ticketSalesInCents)}</td><td>{formatCurrency(day.revenueInCents)}</td></tr>)}</tbody>
      </table></div>
      <Link className="button" href={`/admin/orders?startDate=${dashboard.period.startDate}&endDate=${dashboard.period.endDate}&status=PAID`}>Consultar pedidos e filtrar por evento</Link>
    </section>
  </AdminShell>;
}
