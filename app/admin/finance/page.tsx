import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getFinanceReport } from "@/features/finance/finance-report.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
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

function formatLotDisplayName(lotName: string, optionLabel?: string | null) {
  return optionLabel ? `${lotName} - ${optionLabel}` : lotName;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const admin = await requirePermission("FINANCE");
  const organizationContext = await getCurrentOrganizationContext();
  const params = await searchParams;
  const report = await getFinanceReport(params, admin.organizationId, getAdminAllowedEventIds(admin));
  const exportParams = new URLSearchParams({
    ...(report.filters.eventId ? { eventId: report.filters.eventId } : {}),
    ...(report.filters.startDate ? { startDate: report.filters.startDate } : {}),
    ...(report.filters.endDate ? { endDate: report.filters.endDate } : {})
  }).toString();
  const exportHref = `/admin/finance/export?${exportParams}`;
  const exportPdfHref = `/admin/finance/export/pdf?${exportParams}`;

  return (
    <AdminShell
      title="Venda de ingressos"
      description="Acompanhe apenas as vendas pagas por dia, período, evento e comprador."
    >
      <section className="operationCommandStrip spacedSection" aria-label="Atalhos da área financeira">
        <article className="operationCommandCard">
          <span className="eyebrow">Saúde financeira</span>
          <h2>Vendas pagas da {organizationContext.brandName} com leitura direta para operação.</h2>
          <p>Use esta tela para ver quantas vendas pagas entraram hoje ou no período, quem comprou, de qual evento foi a venda e qual ingresso saiu.</p>
        </article>
        <div className="operationCommandActions">
          <Link className="secondaryButton smallButton" href="/admin">
            Dashboard
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/orders">
            Pedidos
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/events">
            Eventos
          </Link>
        </div>
      </section>

      <section className="adminPanelHero compact">
        <div>
          <span className="sectionEyebrow">Saúde financeira</span>
          <h2>Vendas pagas com leitura comercial mais simples</h2>
          <p className="muted">
            O objetivo desta tela é bater o olho e entender o que foi vendido de verdade no período, sem misturar pedido pendente com venda confirmada.
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
          <Link className="secondaryButton" href={exportPdfHref}>
            Exportar PDF
          </Link>
        </form>
      </section>

      <section className="grid dashboardGrid">
        <article className="card dashboardHeroMetric metric">
          <span className="muted">Vendas pagas</span>
          <strong>{report.totals.paidOrders}</strong>
          <small>Pedidos confirmados no período filtrado</small>
        </article>
        <article className="card metric">
          <span className="muted">Faturamento pago</span>
          <strong>{formatCurrency(report.totals.grossRevenueInCents)}</strong>
          <small>Total pago pelo cliente: ingressos + taxas + juros - descontos</small>
        </article>
        <article className="card metric">
          <span className="muted">Venda de ingressos</span>
          <strong>{formatCurrency(report.totals.ticketSubtotalInCents)}</strong>
          <small>Valor dos ingressos, sem taxas do sistema</small>
        </article>
        <article className="card metric">
          <span className="muted">Taxas recebidas</span>
          <strong>{formatCurrency(report.totals.serviceFeeInCents)}</strong>
          <small>Taxa de sistema faturada nas vendas pagas</small>
        </article>
        <article className="card metric">
          <span className="muted">Ingressos emitidos</span>
          <strong>{report.totals.ticketsIssued}</strong>
          <small>Unidades emitidas nas vendas pagas</small>
        </article>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Vendas pagas no período</h2>
            <p className="muted">
              Mostrando todas as {report.totals.paidOrders} venda(s) confirmada(s) do período filtrado. Ingressos emitidos
              podem ser maiores quando uma venda gera mais de uma unidade.
            </p>
          </div>
        </div>
        {report.paidOrders.length === 0 ? (
          <div className="empty">Nenhuma venda paga encontrada nesse recorte.</div>
        ) : (
          <div className="tableScroll">
            <table className="table financeTable">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Comprador</th>
                  <th>Evento</th>
                  <th>Ingresso</th>
                  <th>Total</th>
                  <th>Pago</th>
                </tr>
              </thead>
              <tbody>
                {report.paidOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{formatDateTime(order.paidAt ?? order.createdAt)}</td>
                    <td>
                      {order.customer.name}
                      <br />
                      <span className="muted">{order.customer.email}</span>
                    </td>
                    <td>{order.event.title}</td>
                    <td>
                      {Array.from(
                        new Set(order.items.map((item) => formatLotDisplayName(item.lot.name, item.lotOption?.label)))
                      ).join(", ")}
                    </td>
                    <td>{formatCurrency(order.totalInCents)}</td>
                    <td>
                      <span className="status published">Sim</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Composição do faturamento pago</h2>
            <p className="muted">Use este quadro para conferir o valor cheio das vendas confirmadas e seus componentes comerciais.</p>
          </div>
        </div>
        <div className="financeStatusGrid">
          <div>
            <span>Venda de ingressos</span>
            <strong>{formatCurrency(report.totals.ticketSubtotalInCents)}</strong>
          </div>
          <div>
            <span>Taxas recebidas</span>
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
        </div>
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
                  <th>Taxas recebidas</th>
                  <th>Juros</th>
                  <th>Descontos</th>
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
                <th>Venda de ingressos</th>
                <th>Taxas recebidas</th>
                <th>Juros</th>
                <th>Descontos</th>
                <th>Bruto</th>
              </tr>
            </thead>
            <tbody>
              {report.byEvent.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.count}</td>
                  <td>{row.tickets}</td>
                  <td>{formatCurrency(row.ticketSubtotalInCents)}</td>
                  <td>{formatCurrency(row.serviceFeeInCents)}</td>
                  <td>{formatCurrency(row.cardInterestInCents)}</td>
                  <td>{formatCurrency(row.discountInCents)}</td>
                  <td>{formatCurrency(row.grossInCents)}</td>
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
                <th>Venda de ingressos</th>
                <th>Taxas recebidas</th>
                <th>Juros</th>
                <th>Descontos</th>
                <th>Bruto</th>
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
