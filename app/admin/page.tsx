import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getDashboardMetrics } from "@/features/dashboard/dashboard.service";
import { getPlatformOverview } from "@/features/platform/platform.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getPublicEventUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<{
    startDate?: string;
    endDate?: string;
  }>;
};

function metric(label: string, value: string | number, note: string, emphasized = false) {
  return (
    <article className={`card metric ${emphasized ? "dashboardHeroMetric" : ""}`}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function formatPeriodLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00-03:00`);
  const end = new Date(`${endDate}T00:00:00-03:00`);

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  return `De ${formatter.format(start)} a ${formatter.format(end)}`;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const admin = await requirePermission("DASHBOARD");
  const params = searchParams ? await searchParams : {};
  const organizationContext = await getCurrentOrganizationContext();
  const isPlatformHost = organizationContext.isPlatformHost;
  const [dashboard, platformOverview] = await Promise.all([
    getDashboardMetrics(params, getAdminAllowedEventIds(admin)),
    isPlatformHost ? getPlatformOverview() : Promise.resolve(null)
  ]);
  const periodLabel = formatPeriodLabel(dashboard.period.startDate, dashboard.period.endDate);
  const approvedRateLabel =
    dashboard.periodMetrics.ordersCreated > 0
      ? `${dashboard.periodMetrics.approvedRate}% dos pedidos criados`
      : "Sem pedidos criados no período";

  return (
    <AdminShell
      title={isPlatformHost ? "Ingressas" : "Dashboard"}
      description={
        isPlatformHost
          ? "Acompanhe a plataforma-mãe, a saúde das operações embaixo dela e a operação-base sem perder contexto."
          : "Acompanhe faturamento, pedidos, meios de pagamento e desempenho dos eventos por período."
      }
    >
      {isPlatformHost && platformOverview ? (
        <section className="platformOverviewPanel spacedSection" aria-label="Resumo da plataforma">
          <div className="platformOverviewHero">
            <div>
              <span className="eyebrow">Modo plataforma</span>
              <h2>{organizationContext.platformName} já está pronta para sustentar mais de uma bilheteria.</h2>
              <p>
                O motor principal já separa operações, branding por host e escopo interno. O próximo passo é plugar os
                domínios reais de cada operação filha sem duplicar código.
              </p>
            </div>
            <div className="platformOverviewBadges">
              <span>Base única</span>
              <span>Domínio por operação</span>
              <span>Equipe e eventos isolados</span>
            </div>
          </div>

          <div className="grid dashboardGrid platformOverviewMetrics">
            {metric("Operações", platformOverview.totalOrganizations, `${platformOverview.activeOrganizations} ativas`)}
            {metric("Domínios configurados", platformOverview.domainsConfigured, "Público ou admin já apontados")}
            {metric("Eventos na base", platformOverview.totalEvents, `${platformOverview.publishedEvents} publicados`)}
            {metric("Usuários internos", platformOverview.totalAdmins, "Acessos somados na plataforma")}
          </div>

          <div className="dashboardPanel platformOperationsPanel">
            <div className="sectionHeader inlineHeader">
              <div>
                <h2>Operações já estruturadas</h2>
                <p>Esta leitura mostra o que já existe na base antes de conectar os próximos domínios.</p>
              </div>
            </div>

            <div className="tableScroll">
              <table className="table operationalTable">
                <thead>
                  <tr>
                    <th>Operação</th>
                    <th>Status</th>
                    <th>Eventos</th>
                    <th>Equipe</th>
                    <th>Domínio público</th>
                    <th>Domínio admin</th>
                  </tr>
                </thead>
                <tbody>
                  {platformOverview.operations.map((operation) => (
                    <tr key={operation.id}>
                      <td>
                        <strong>{operation.name}</strong>
                        <br />
                        <span className="muted">{operation.slug}</span>
                      </td>
                      <td>
                        <span className={`status ${operation.isActive ? "published" : "draft"}`}>
                          {operation.isActive ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                      <td>{operation.eventCount}</td>
                      <td>{operation.adminCount}</td>
                      <td>{operation.publicDomain || "A conectar"}</td>
                      <td>{operation.adminDomain || "A conectar"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <section className="dashboardFilterPanel" aria-label="Filtro do dashboard">
        <div>
          <span className="eyebrow">{isPlatformHost ? "Operação-base" : "Visão comercial"}</span>
          <h2>{isPlatformHost ? "Resumo da TCR dentro da plataforma" : "Resumo da operação"}</h2>
          <p>
            {isPlatformHost
              ? `${periodLabel}. Enquanto os próximos domínios entram, esta leitura segue mostrando a primeira operação filha da base.`
              : `${periodLabel}. Ajuste as datas para comparar vendas, clientes e desempenho por evento.`}
          </p>
          <div className="dashboardQuickFilters">
            <Link className="secondaryButton smallButton" href="/admin">
              Hoje
            </Link>
            <Link className="secondaryButton smallButton" href="/admin?startDate=&endDate=">
              Janela padrão
            </Link>
            <Link className="secondaryButton smallButton" href="/admin/orders">
              Ver pedidos
            </Link>
            <Link className="secondaryButton smallButton" href="/admin/finance">
              Ir para financeiro
            </Link>
          </div>
        </div>

        <form className="dashboardDateForm">
          <label>
            <span>Início</span>
            <input type="date" name="startDate" defaultValue={dashboard.period.startDate} />
          </label>
          <label>
            <span>Fim</span>
            <input type="date" name="endDate" defaultValue={dashboard.period.endDate} />
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
        </form>
      </section>

      <section className="grid dashboardGrid dashboardPrimaryGrid" aria-label="Indicadores principais">
        {metric(
          "Valor faturado",
          formatCurrency(dashboard.totals.revenueInCents),
          `${dashboard.totals.paidOrders} pedido(s) pagos no período`,
          true
        )}
        {metric(
          "Ticket médio",
          formatCurrency(dashboard.periodMetrics.averageTicketInCents),
          "Média por pedido aprovado"
        )}
        {metric("Pedidos vendidos", dashboard.totals.paidOrders, approvedRateLabel)}
        {metric(
          "Clientes únicos",
          dashboard.periodMetrics.uniqueCustomers,
          `${dashboard.periodMetrics.newCustomerRate}% novos compradores`
        )}
      </section>

      <section className="dashboardInsightsGrid" aria-label="Pagamentos e clientes">
        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Meios de pagamento</h2>
              <p>Distribuição das vendas aprovadas no período selecionado.</p>
            </div>
          </div>
          <div className="chartLegend">
            <div>
              <span className="legendDot pixDot" />
              <strong>Pix</strong>
              <small>
                {dashboard.periodMetrics.paymentMethods.pix.count} pedido(s) •{" "}
                {formatCurrency(dashboard.periodMetrics.paymentMethods.pix.revenueInCents)} •{" "}
                {dashboard.periodMetrics.paymentMethods.pix.rate}%
              </small>
            </div>
            <div>
              <span className="legendDot cardDot" />
              <strong>Cartão</strong>
              <small>
                {dashboard.periodMetrics.paymentMethods.card.count} pedido(s) •{" "}
                {formatCurrency(dashboard.periodMetrics.paymentMethods.card.revenueInCents)} •{" "}
                {dashboard.periodMetrics.paymentMethods.card.rate}%
              </small>
            </div>
            <div>
              <span className="legendDot otherDot" />
              <strong>Outros</strong>
              <small>
                {dashboard.periodMetrics.paymentMethods.other.count} pedido(s) •{" "}
                {formatCurrency(dashboard.periodMetrics.paymentMethods.other.revenueInCents)} •{" "}
                {dashboard.periodMetrics.paymentMethods.other.rate}%
              </small>
            </div>
          </div>
        </div>

        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Clientes</h2>
              <p>Novos compradores versus retorno de clientes já existentes.</p>
            </div>
          </div>
          <div className="chartLegend">
            <div>
              <span className="legendDot pixDot" />
              <strong>Novos</strong>
              <small>
                {dashboard.periodMetrics.newCustomerOrders} pedido(s) •{" "}
                {dashboard.periodMetrics.newCustomerRate}%
              </small>
            </div>
            <div>
              <span className="legendDot cardDot" />
              <strong>Recorrentes</strong>
              <small>
                {dashboard.periodMetrics.returningCustomerOrders} pedido(s) •{" "}
                {dashboard.periodMetrics.returningCustomerRate}%
              </small>
            </div>
          </div>
          <div className="dashboardNote">
            Base de {dashboard.totals.paidOrders} pedido(s) aprovados com cliente identificado.
          </div>
        </div>
      </section>

      <section className="grid dashboardGrid spacedSection" aria-label="Visão acumulada da operação">
        {metric("Pedidos pendentes", dashboard.totals.pendingOrders, "Pagamentos ainda não confirmados")}
        {metric("Pedidos cancelados", dashboard.totals.canceledOrders, "Cancelados, expirados ou reembolsados")}
        {metric("Ingressos ativos", dashboard.totals.ticketsActive, "Prontos para entrada")}
        {metric("Check-ins aprovados", dashboard.totals.checkInsApproved, "Entradas já validadas")}
      </section>

      <section className="dashboardPanel spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Visão por evento</h2>
            <p>Capacidade, vendidos, reservas e faturamento da operação atual.</p>
          </div>
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
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.events.map((event) => {
                  const soldRate =
                    event.totalCapacity > 0 ? Math.round((event.soldQuantity / event.totalCapacity) * 100) : 0;

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
                        <span className={`status ${event.status === "PUBLISHED" ? "published" : "draft"}`}>
                          {event.status === "PUBLISHED" ? "Publicado" : "Em preparação"}
                        </span>
                      </td>
                      <td>{formatDateTime(event.startsAt)}</td>
                      <td>
                        <div className="progressCell">
                          <div className="progressMeta">
                            <span>
                              {event.soldQuantity} / {event.totalCapacity}
                            </span>
                            <strong>{soldRate}%</strong>
                          </div>
                          <div className="progressTrack" aria-label={`${soldRate}% vendido`}>
                            <span style={{ width: `${soldRate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>{event.reservedQuantity}</td>
                      <td>{formatCurrency(event.revenueInCents)}</td>
                      <td>
                        {event.usedTickets} usado(s)
                        <br />
                        <span className="muted">{event.activeTickets} ativo(s)</span>
                      </td>
                      <td>
                        <div className="actionRow">
                          <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}`}>
                            Gerenciar
                          </Link>
                          <Link className="secondaryButton smallButton" href={getPublicEventUrl(event.slug)}>
                            Público
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

      <section className="dashboardPanel spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Pedidos recentes</h2>
            <p>Últimas movimentações para acompanhar suporte, aprovação e conferência rápida.</p>
          </div>
          <Link className="secondaryButton" href="/admin/orders">
            Ver todos
          </Link>
        </div>

        {dashboard.recentOrders.length === 0 ? (
          <div className="empty">Nenhum pedido registrado ainda.</div>
        ) : (
          <div className="tableScroll wideTableScroll">
            <table className="table operationalTable ordersTable">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Evento</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                  <th>Total</th>
                  <th>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentOrders.map((order) => (
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
                    <td>
                      <span className={`status ${order.status === "PAID" ? "published" : "draft"}`}>
                        {order.status === "PAID"
                          ? "Pago"
                          : order.status === "PENDING_PAYMENT"
                            ? "Pendente"
                            : order.status === "EXPIRED"
                              ? "Expirado"
                              : order.status === "CANCELED"
                                ? "Cancelado"
                                : "Rascunho"}
                      </span>
                    </td>
                    <td>{order.payment?.status ?? "-"}</td>
                    <td>{formatCurrency(order.totalInCents)}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
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
