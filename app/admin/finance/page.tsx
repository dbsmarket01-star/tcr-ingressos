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
  CREDIT_CARD: "Cartao",
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
      description="Faturamento, pagamentos, pedidos e liquido aproximado por periodo."
    >
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
            <span>Inicio</span>
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
          <span className="muted">Juros de cartao</span>
          <strong>{formatCurrency(report.totals.cardInterestInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Descontos</span>
          <strong>{formatCurrency(report.totals.discountInCents)}</strong>
        </article>
      </section>

      <section className="grid dashboardGrid spacedSection">
        <article className="card metric">
          <span className="muted">Liquido aproximado</span>
          <strong>{formatCurrency(report.totals.netRevenueInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Taxas identificadas</span>
          <strong>{formatCurrency(report.totals.estimatedFeesInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Pedidos pagos</span>
          <strong>{report.totals.paidOrders}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Pendente no periodo</span>
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
          <span className="muted">Liquido real Asaas</span>
          <strong>{report.totals.netValueCoverage}%</strong>
        </article>
        <article className="card metric">
          <span className="muted">Split enviado</span>
          <strong>{formatCurrency(report.totals.splitTotalInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">TCR apos split</span>
          <strong>{formatCurrency(report.totals.tcrAfterSplitInCents)}</strong>
        </article>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Resumo de repasse</h2>
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
            <span>Liquido aproximado</span>
            <strong>{formatCurrency(report.totals.netRevenueInCents)}</strong>
          </div>
          <div>
            <span>Cobertura do liquido real</span>
            <strong>{report.totals.netValueCoverage}% dos pagos</strong>
          </div>
          <div>
            <span>Split automatico</span>
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
          O liquido aproximado usa o valor liquido retornado pelo provedor quando disponivel. Quando o provedor nao informa,
          o sistema usa o total pago como referencia conservadora para nao esconder receita.
        </p>
      </section>

      <section className="grid twoColumns spacedSection">
        <article className="card">
          <div className="sectionHeader inlineHeader">
            <h2>Por forma de pagamento</h2>
          </div>
          {report.byMethod.length === 0 ? (
            <div className="empty">Nenhum pagamento aprovado no periodo.</div>
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
                  <th>Liquido</th>
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
              <span>Pedidos no periodo</span>
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
          <div className="empty">Nenhum split retornado pelo provedor no periodo.</div>
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
          e compensacao dentro do proprio Asaas.
        </p>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Faturamento por evento</h2>
        </div>
        {report.byEvent.length === 0 ? (
          <div className="empty">Nenhum faturamento confirmado no periodo.</div>
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
