import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getFinanceReport } from "@/features/finance/finance-report.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type FinancePageProps = {
  searchParams: Promise<{
    eventId?: string;
    startDate?: string;
    endDate?: string;
  }>;
};

const methodLabels = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão",
  SIMULATED: "Simulado",
  OTHER: "Outro"
};

const orderStatusLabels = {
  DRAFT: "Rascunho",
  PENDING_PAYMENT: "Pendente",
  PAID: "Pago",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado"
};

export default async function FinancePage({ searchParams }: FinancePageProps) {
  await requirePermission("FINANCE");
  const params = await searchParams;
  const report = await getFinanceReport(params);
  const exportHref = `/admin/finance/export?${new URLSearchParams({
    ...(report.filters.eventId ? { eventId: report.filters.eventId } : {}),
    ...(report.filters.startDate ? { startDate: report.filters.startDate } : {}),
    ...(report.filters.endDate ? { endDate: report.filters.endDate } : {})
  }).toString()}`;

  return (
    <AdminShell
      title="Financeiro"
      description="Faturamento, pagamentos e repasses do período com leitura mais objetiva."
    >
      <section className="adminPanelHero compact">
        <div>
          <span className="sectionEyebrow">Saúde financeira</span>
          <h2>Números mais claros para decidir rápido</h2>
          <p className="muted">
            O objetivo desta tela é bater o olho e entender o que entrou, o que ainda está pendente e quanto já saiu em split, sem ficar caçando informação em blocos demais.
          </p>
        </div>
      </section>

      <section className="card financeFilters">
        <form className="financeFiltersForm">
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
            <span>Início</span>
            <input type="date" name="startDate" defaultValue={report.filters.startDate} />
          </label>
          <label className="field">
            <span>Fim</span>
            <input type="date" name="endDate" defaultValue={report.filters.endDate} />
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
          <Link className="secondaryButton" href="/admin/finance">
            Limpar
          </Link>
          <Link className="button" href={exportHref}>
            Exportar CSV
          </Link>
        </form>
      </section>

      <section className="grid dashboardGrid">
        <article className="card dashboardHeroMetric metric">
          <span className="muted">Líquido aproximado</span>
          <strong>{formatCurrency(report.totals.netRevenueInCents)}</strong>
          <small>Referência principal do período filtrado</small>
        </article>
        <article className="card metric">
          <span className="muted">Bruto confirmado</span>
          <strong>{formatCurrency(report.totals.grossRevenueInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Ingressos</span>
          <strong>{formatCurrency(report.totals.ticketSubtotalInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Taxas e impostos</span>
          <strong>{formatCurrency(report.totals.serviceFeeInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Juros de cartão</span>
          <strong>{formatCurrency(report.totals.cardInterestInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Descontos</span>
          <strong>{formatCurrency(report.totals.discountInCents)}</strong>
        </article>
      </section>

      <section className="grid dashboardGrid spacedSection">
        <article className="card metric">
          <span className="muted">Taxas identificadas</span>
          <strong>{formatCurrency(report.totals.estimatedFeesInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Pedidos pagos</span>
          <strong>{report.totals.paidOrders}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Pendente no período</span>
          <strong>{formatCurrency(report.totals.pendingAmountInCents)}</strong>
        </article>
      </section>

      <section className="grid dashboardGrid spacedSection">
        <article className="card metric">
          <span className="muted">Cancelado/expirado</span>
          <strong>{formatCurrency(report.totals.canceledAmountInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Ingressos emitidos</span>
          <strong>{report.totals.ticketsIssued}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Líquido real Asaas</span>
          <strong>{report.totals.netValueCoverage}%</strong>
        </article>
        <article className="card metric">
          <span className="muted">Split enviado</span>
          <strong>{formatCurrency(report.totals.splitTotalInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">TCR após split</span>
          <strong>{formatCurrency(report.totals.tcrAfterSplitInCents)}</strong>
        </article>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Resumo de repasse</h2>
            <p className="muted">Use este quadro para conferir rapidamente o que ficou com a operação e o que saiu no split.</p>
          </div>
        </div>
        <div className="financeStatusGrid">
          <div>
            <span>Valor dos ingressos</span>
            <strong>{formatCurrency(report.totals.ticketSubtotalInCents)}</strong>
          </div>
          <div>
            <span>Taxas cobradas</span>
            <strong>{formatCurrency(report.totals.serviceFeeInCents)}</strong>
          </div>
          <div>
            <span>Juros cobrados</span>
            <strong>{formatCurrency(report.totals.cardInterestInCents)}</strong>
          </div>
          <div>
            <span>Descontos concedidos</span>
            <strong>{formatCurrency(report.totals.discountInCents)}</strong>
          </div>
          <div>
            <span>Líquido aproximado</span>
            <strong>{formatCurrency(report.totals.netRevenueInCents)}</strong>
          </div>
          <div>
            <span>Cobertura do líquido real</span>
            <strong>{report.totals.netValueCoverage}% dos pagos</strong>
          </div>
          <div>
            <span>Split automático</span>
            <strong>{formatCurrency(report.totals.splitTotalInCents)}</strong>
          </div>
          <div>
            <span>Pedidos com split</span>
            <strong>{report.totals.splitPaymentsCount} pedido(s)</strong>
          </div>
          <div>
            <span>Cobertura do split</span>
            <strong>{report.totals.splitCoverage}% dos pagos</strong>
          </div>
        </div>
        <p className="muted">
          O líquido aproximado usa o valor líquido retornado pelo provedor quando disponível. Quando o provedor não informa,
          o sistema usa o total pago como referência conservadora para não esconder receita.
        </p>
      </section>

      <section className="grid twoColumns spacedSection">
        <article className="card">
          <div className="sectionHeader inlineHeader">
            <h2>Por forma de pagamento</h2>
          </div>
          {report.byMethod.length === 0 ? (
            <div className="empty">Nenhum pagamento aprovado no período.</div>
          ) : (
            <div className="tableScroll">
            <table className="table financeTable">
              <thead>
                <tr>
                  <th>Forma</th>
                  <th>Pedidos</th>
                  <th>Bruto</th>
                  <th>Taxas</th>
                  <th>Juros</th>
                  <th>Descontos</th>
                  <th>Líquido</th>
                </tr>
              </thead>
              <tbody>
                {report.byMethod.map((row) => (
                  <tr key={row.method}>
                    <td>{methodLabels[row.method]}</td>
                    <td>{row.count}</td>
                    <td>{formatCurrency(row.grossInCents)}</td>
                    <td>{formatCurrency(row.serviceFeeInCents)}</td>
                    <td>{formatCurrency(row.cardInterestInCents)}</td>
                    <td>{formatCurrency(row.discountInCents)}</td>
                    <td>{formatCurrency(row.netInCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </article>

        <article className="card">
          <div className="sectionHeader inlineHeader">
            <h2>Status dos pedidos</h2>
          </div>
          <div className="financeStatusGrid">
            <div>
              <span>Pedidos no período</span>
              <strong>{report.totals.ordersInPeriod}</strong>
            </div>
            <div>
              <span>Pendentes</span>
              <strong>{report.totals.pendingOrders}</strong>
            </div>
            <div>
              <span>Cancelados</span>
              <strong>{report.totals.canceledOrders}</strong>
            </div>
            <div>
              <span>Pagamentos falhos</span>
              <strong>{report.totals.failedPayments}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Split Asaas por carteira</h2>
        </div>
        {report.bySplitWallet.length === 0 ? (
            <div className="empty">Nenhum split retornado pelo provedor no período.</div>
        ) : (
          <div className="tableScroll">
            <table className="table financeTable">
              <thead>
                <tr>
                  <th>Carteira</th>
                  <th>Status no Asaas</th>
                  <th>Ocorrencias</th>
                  <th>Total previsto</th>
                </tr>
              </thead>
              <tbody>
                {report.bySplitWallet.map((row) => (
                  <tr key={`${row.walletId}:${row.status}`}>
                    <td>{row.walletLabel}</td>
                    <td>{row.status}</td>
                    <td>{row.count}</td>
                    <td>{formatCurrency(row.totalInCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">
          Esta leitura vem do retorno do Asaas salvo no pagamento. O status financeiro final ainda depende do processamento
          e da compensação dentro do próprio Asaas.
        </p>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Faturamento por evento</h2>
        </div>
        {report.byEvent.length === 0 ? (
          <div className="empty">Nenhum faturamento confirmado no período.</div>
        ) : (
          <div className="tableScroll">
          <table className="table financeTable">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Pedidos pagos</th>
                <th>Ingressos</th>
                <th>Taxas</th>
                <th>Juros</th>
                <th>Descontos</th>
                <th>Bruto</th>
                <th>Liquido</th>
              </tr>
            </thead>
            <tbody>
              {report.byEvent.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.count}</td>
                  <td>{row.tickets}</td>
                  <td>{formatCurrency(row.serviceFeeInCents)}</td>
                  <td>{formatCurrency(row.cardInterestInCents)}</td>
                  <td>{formatCurrency(row.discountInCents)}</td>
                  <td>{formatCurrency(row.grossInCents)}</td>
                  <td>{formatCurrency(row.netInCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Origem das vendas</h2>
        </div>
        {report.bySource.length === 0 ? (
          <div className="empty">Nenhuma origem registrada no periodo.</div>
        ) : (
          <div className="tableScroll">
          <table className="table financeTable">
            <thead>
              <tr>
                <th>Origem</th>
                <th>Pedidos</th>
                <th>Ingressos</th>
                <th>Taxas</th>
                <th>Juros</th>
                <th>Descontos</th>
                <th>Bruto</th>
                <th>Liquido</th>
              </tr>
            </thead>
            <tbody>
              {report.bySource.map((row) => (
                <tr key={row.source}>
                  <td>{row.source}</td>
                  <td>{row.count}</td>
                  <td>{formatCurrency(row.ticketSubtotalInCents)}</td>
                  <td>{formatCurrency(row.serviceFeeInCents)}</td>
                  <td>{formatCurrency(row.cardInterestInCents)}</td>
                  <td>{formatCurrency(row.discountInCents)}</td>
                  <td>{formatCurrency(row.grossInCents)}</td>
                  <td>{formatCurrency(row.netInCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Pagamentos confirmados recentes</h2>
        </div>
        {report.recentPaidOrders.length === 0 ? (
          <div className="empty">Nenhum pagamento confirmado no periodo.</div>
        ) : (
          <div className="tableScroll">
          <table className="table operationalTable">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Evento</th>
                <th>Pago em</th>
                <th>Status</th>
                <th>Origem</th>
                <th>Desconto</th>
                <th>Split</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {report.recentPaidOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/orders/${order.code}`}>
                      <strong>{order.code}</strong>
                    </Link>
                  </td>
                  <td>
                    {order.customer.name}
                    <br />
                    <span className="muted">{order.customer.email}</span>
                  </td>
                  <td>{order.event.title}</td>
                  <td>{order.paidAt ? formatDateTime(order.paidAt) : "-"}</td>
                  <td>
                    <span className="status published">{orderStatusLabels[order.status]}</span>
                  </td>
                  <td>{order.utmSource || order.utmMedium ? `${order.utmSource ?? "-"} / ${order.utmMedium ?? "-"}` : "Direto"}</td>
                  <td>{formatCurrency(order.discountInCents)}</td>
                  <td>
                    {order.splitSummary.entries.length > 0 ? (
                      <>
                        {formatCurrency(order.splitSummary.totalInCents)}
                        <br />
                        <span className="muted">
                          {order.splitSummary.entries.map((entry) => `${entry.walletLabel} ${entry.status}`).join(", ")}
                        </span>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{formatCurrency(order.totalInCents)}</td>
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
