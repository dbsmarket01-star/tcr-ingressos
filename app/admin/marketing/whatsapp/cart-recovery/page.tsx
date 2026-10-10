import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCartRecoveryReport } from "@/features/reports/cart-recovery-report.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CartRecoveryReportPage({
  searchParams
}: {
  searchParams?: Promise<{ days?: string }>;
}) {
  const admin = await requirePermission("MARKETING");
  const params = searchParams ? await searchParams : {};
  const days = params.days === "30" ? 30 : 7;
  const report = await getCartRecoveryReport(admin.organizationId!, days, getAdminAllowedEventIds(admin));

  return (
    <AdminShell
      title="Recuperação de carrinho"
      description="Mensagens, respostas e compras posteriores associadas por evento."
      headerVariant="minimal"
      hideSidebarIntro
    >
      <section className="card spacedSection adminPanelBlock">
        <div className="financeFiltersForm">
          <Link className={days === 7 ? "button" : "secondaryButton"} href="/admin/marketing/whatsapp/cart-recovery">Últimos 7 dias</Link>
          <Link className={days === 30 ? "button" : "secondaryButton"} href="/admin/marketing/whatsapp/cart-recovery?days=30">Últimos 30 dias</Link>
          <Link className="secondaryButton" href="/admin/marketing/whatsapp">Voltar aos disparos</Link>
        </div>
        <p className="muted">Disparos entre {formatDateTime(report.since)} e {formatDateTime(report.until)}.</p>
      </section>

      <section className="grid dashboardGrid adminMetricsDense">
        <article className="card metric"><span className="muted">Tentativas</span><strong>{report.totals.attempts}</strong></article>
        <article className="card metric"><span className="muted">Aceitas pela API</span><strong>{report.totals.accepted}</strong></article>
        <article className="card metric"><span className="muted">Entregues</span><strong>{report.totals.delivered}</strong></article>
        <article className="card metric"><span className="muted">Responderam</span><strong>{report.totals.replies}</strong></article>
        <article className="card metric"><span className="muted">Compras posteriores</span><strong>{report.totals.paidOrders}</strong></article>
        <article className="card metric"><span className="muted">Ingressos válidos</span><strong>{report.totals.tickets}</strong></article>
        <article className="card metric"><span className="muted">Faturamento associado</span><strong>{formatCurrency(report.totals.grossInCents)}</strong></article>
      </section>

      <section className="card spacedSection adminPanelBlock">
        <h2>Resultado por evento</h2>
        {report.byEvent.length === 0 ? <p className="muted">Nenhum disparo no período.</p> : (
          <div className="tableScroll wideTableScroll adminTableWrap">
            <table className="table operationalTable">
              <thead><tr>
                <th>Evento</th><th>Tentativas</th><th>Aceitas</th><th>Entregues</th><th>Lidas</th>
                <th>Falhas</th><th>Responderam</th><th>Compras posteriores</th><th>Do pedido original</th>
                <th>Ingressos válidos</th><th>Faturamento associado</th>
              </tr></thead>
              <tbody>{report.byEvent.map((row) => (
                <tr key={row.eventId}>
                  <td><strong>{row.eventTitle}</strong></td><td>{row.attempts}</td><td>{row.accepted}</td>
                  <td>{row.delivered}</td><td>{row.read}</td><td>{row.failed}</td><td>{row.replies}</td>
                  <td>{row.paidOrders}</td><td>{row.originalOrdersPaid}</td><td>{row.tickets}</td>
                  <td>{formatCurrency(row.grossInCents)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="muted">
          Compra associada = pedido pago do mesmo carrinho, ou compra do mesmo telefone e evento, até 7 dias após um disparo aceito pela API.
          Cada compra é contada uma vez. O faturamento é o total pago menos estornos registrados; ingressos são admissões válidas, inclusive utilizadas.
          Essa associação temporal não prova que a mensagem causou a venda.
        </p>
      </section>
    </AdminShell>
  );
}
