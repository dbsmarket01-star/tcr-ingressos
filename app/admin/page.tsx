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

  if (organizationContext.isPlatformHost) {
    const platformOverview = await getPlatformOverview();
    const activeOperations = platformOverview.operations.filter((item) => item.isActive);
    const revenueInCents = activeOperations.reduce((total, item) => total + item.paidRevenueInCents, 0);
    const paidOrders = activeOperations.reduce((total, item) => total + item.paidOrdersCount, 0);
    const activeLeads = activeOperations.reduce((total, item) => total + item.leadsCount, 0);
    const operationsWithInitialTeam = activeOperations.filter((item) => item.adminCount > 0).length;
    const operationsWithFullDomains = activeOperations.filter((item) => item.publicDomain && item.adminDomain).length;
    const operationsWithSecurityBase = activeOperations.filter(
      (item) => item.adminCount > 0 && item.publicDomain && item.adminDomain
    ).length;
    const readyOperations = activeOperations.filter((item) => item.readinessScore >= 67).length;

    return (
      <AdminShell
        title="Ingresaas"
        description="Painel master da plataforma, com leitura consolidada das bilheterias filhas, domínios e equipe."
      >
        <section className="platformOverviewPanel spacedSection" aria-label="Resumo da plataforma">
          <div className="platformOverviewHero">
            <div>
              <span className="eyebrow">Painel master</span>
              <h2>Você está no comando da plataforma. Aqui enxergamos o todo; em Operações, cuidamos de cada cliente.</h2>
              <p>
                Use esta tela para ter uma leitura rápida da base inteira. Quando quiser criar cliente,
                revisar domínio ou entrar numa bilheteria filha, o próximo lugar é Operações.
              </p>
            </div>
            <div className="platformOverviewBadges">
              <span>Visão geral</span>
              <span>Clientes</span>
              <span>Segurança</span>
            </div>
          </div>

          <div className="platformMasterActionBar">
            <Link className="button smallButton" href="/admin/operations">
              Ir para clientes
            </Link>
          </div>
        </section>

        <section className="grid dashboardGrid platformOverviewMetrics spacedSection">
          {metric("Clientes ativos", activeOperations.length, `${readyOperations} prontos para operar`, true)}
          {metric("Receita paga", formatCurrency(revenueInCents), `${paidOrders} pedido(s) pagos nas operações`)}
          {metric("Eventos publicados", platformOverview.publishedEvents, "Eventos ativos nas bilheterias filhas")}
          {metric("Leads", activeLeads, "Captações registradas na base")}
        </section>

        <section className="grid twoColumns spacedSection platformMasterSections">
          <article className="dashboardPanel platformMasterSectionCard">
            <span className="eyebrow">Dashboard</span>
            <h2>Leitura rápida da plataforma</h2>
            <p>
              Veja quantos clientes estão ativos, quanto já foi pago, quantos eventos já estão publicados
              e se a base está saudável para crescer.
            </p>
            <div className="platformSecurityStack compact">
              <div>
                <span>Clientes com equipe inicial</span>
                <strong>{operationsWithInitialTeam}</strong>
              </div>
              <div>
                <span>Clientes com domínio completo</span>
                <strong>{operationsWithFullDomains}</strong>
              </div>
              <div>
                <span>Clientes com base segura</span>
                <strong>{operationsWithSecurityBase}</strong>
              </div>
            </div>
          </article>

          <article className="dashboardPanel platformMasterSectionCard">
            <span className="eyebrow">Clientes</span>
            <h2>Crie e administre bilheterias filhas sem bagunça.</h2>
            <p>
              Em Operações você cadastra domínio, branding, usuário inicial e depois entra na central
              do cliente para revisar equipe, eventos, pedidos e financeiro.
            </p>
            <ol className="platformChecklist compact">
              <li>Criar cliente</li>
              <li>Definir domínio e identidade</li>
              <li>Entregar acesso inicial</li>
              <li>Abrir a central da operação</li>
            </ol>
            <Link className="secondaryButton smallButton" href="/admin/operations">
              Abrir operações
            </Link>
          </article>

          <article className="dashboardPanel platformMasterSectionCard">
            <span className="eyebrow">Segurança</span>
            <h2>A plataforma vê tudo; cada cliente vê só o que é dele.</h2>
            <p>
              A separação entre master, cliente e equipe restrita continua sendo a base para não
              misturar dados, permissões e configurações entre operações.
            </p>
            <div className="platformSecurityList">
              <span>Login por cliente</span>
              <span>Domínio admin separado</span>
              <span>Papel restrito por equipe</span>
              <span>Configuração isolada</span>
            </div>
          </article>
        </section>

        <section className="dashboardPanel platformOperationsPanel spacedSection">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Resumo dos clientes</h2>
              <p>Uma leitura rápida para saber quem já está pronto, quem ainda está montando base e quem já está vendendo.</p>
            </div>
            <Link className="button" href="/admin/operations">
              Ver clientes
            </Link>
          </div>

          <div className="platformOperationsGrid">
            {platformOverview.operations.map((operation) => {
              const ready = Boolean(operation.publicDomain && operation.adminDomain);
              const supportSummary = operation.supportEmail || operation.supportPhone || "Suporte ainda não definido";

              return (
                <article className="card platformOperationCard" key={operation.id}>
                  <div
                    className="platformOperationAccent"
                    style={{ background: operation.primaryColor || "linear-gradient(135deg, #0f172a, #334155)" }}
                  />
                  <div className="platformOperationHeader">
                    <div>
                      <strong>{operation.name}</strong>
                      <span>{operation.slug}</span>
                    </div>
                    <span className={`status ${ready ? "published" : "pending"}`}>{ready ? "Pronta" : "Em preparo"}</span>
                  </div>

                  <div className="platformOperationMeta">
                    <div>
                      <span>Eventos</span>
                      <strong>{operation.eventCount}</strong>
                    </div>
                    <div>
                      <span>Equipe</span>
                      <strong>{operation.adminCount}</strong>
                    </div>
                    <div>
                      <span>Suporte</span>
                      <strong>{supportSummary}</strong>
                    </div>
                  </div>

                  <div className="platformReadinessBar" aria-label={`Prontidão de ${operation.readinessScore}%`}>
                    <span style={{ width: `${operation.readinessScore}%` }} />
                  </div>

                  <div className="platformReadinessTags">
                    {operation.readinessItems.map((item) => (
                      <span className={item.done ? "isDone" : "isTodo"} key={item.label}>
                        {item.label}
                      </span>
                    ))}
                  </div>

                  <div className="platformOperationLinks">
                    <span>{operation.publicDomain || "Domínio público pendente"}</span>
                    <span>{operation.adminDomain || "Domínio admin pendente"}</span>
                  </div>

                  <div className="actionRow">
                    <Link className="secondaryButton smallButton" href={`/admin/operations/${operation.id}`}>
                      Ver detalhe
                    </Link>
                    {operation.adminDomain ? (
                      <a className="button smallButton" href={`https://${operation.adminDomain}/admin`} target="_blank" rel="noreferrer">
                        Entrar na operação
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </AdminShell>
    );
  }

  const dashboard = await getDashboardMetrics(params, getAdminAllowedEventIds(admin));
  const periodLabel = formatPeriodLabel(dashboard.period.startDate, dashboard.period.endDate);
  const approvedRateLabel =
    dashboard.periodMetrics.ordersCreated > 0
      ? `${dashboard.periodMetrics.approvedRate}% dos pedidos criados`
      : "Sem pedidos criados no período";

  return (
    <AdminShell
      title="Dashboard"
      description="Acompanhe faturamento pago, pedidos, meios de pagamento e o estado operacional da TCR por período."
    >
      <section className="operationCommandStrip spacedSection" aria-label="Atalhos da operação">
        <article className="operationCommandCard">
          <span className="eyebrow">Rotina da operação filha</span>
          <h2>{organizationContext.brandName} em visão rápida dentro da Ingresaas</h2>
          <p>Use estes atalhos para sair do panorama geral e cair direto nas áreas mais operacionais da bilheteria, sem perder a ponte com o painel master.</p>
        </article>
        <div className="operationCommandActions">
          <Link className="secondaryButton smallButton" href="/admin/events">
            Eventos
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/orders">
            Pedidos
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/check-in">
            Check-in
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/finance">
            Financeiro
          </Link>
        </div>
      </section>

      <section className="dashboardFilterPanel" aria-label="Filtro do dashboard">
        <div>
          <span className="eyebrow">Visão comercial</span>
          <h2>Resumo comercial da TCR</h2>
          <p>{periodLabel}. Ajuste as datas para comparar apenas o que foi pago, o avanço da agenda e o desempenho por evento.</p>
          <div className="dashboardQuickFilters">
            <Link className="secondaryButton smallButton" href="/admin">
              Últimos 7 dias
            </Link>
            <Link className="secondaryButton smallButton" href="/admin?startDate=&endDate=">
              Limpar datas
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
          "Faturamento pago",
          formatCurrency(dashboard.totals.revenueInCents),
          `${dashboard.totals.paidOrders} pedido(s) pagos no período`,
          true
        )}
        {metric(
          "Ticket médio",
          formatCurrency(dashboard.periodMetrics.averageTicketInCents),
          "Média por pedido aprovado"
        )}
        {metric("Pedidos pagos", dashboard.totals.paidOrders, approvedRateLabel)}
        {metric(
          "Clientes únicos",
          dashboard.periodMetrics.uniqueCustomers,
          `${dashboard.periodMetrics.newCustomerRate}% novos compradores`
        )}
      </section>

      <section className="grid twoColumns spacedSection" aria-label="Checklist final da operação">
        <article className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Checklist operacional final</h2>
              <p>Um retrato rápido do que já está pronto para a TCR operar com menos supervisão.</p>
            </div>
          </div>
          <ol className="platformChecklist">
            <li>{dashboard.events.some((event) => event.status === "PUBLISHED") ? "Existe agenda publicada para venda" : "Ainda falta publicar pelo menos um evento"}</li>
            <li>{dashboard.totals.paidOrders > 0 ? "Já existem pedidos pagos válidos" : "Ainda não há pedidos pagos no recorte atual"}</li>
            <li>{dashboard.totals.ticketsActive > 0 ? "Ingressos ativos já estão emitidos" : "Ainda falta emitir ingressos ativos"}</li>
            <li>{dashboard.totals.checkInsApproved > 0 ? "Check-in já rodou na operação" : "Check-in ainda não foi exercitado no recorte atual"}</li>
          </ol>
        </article>

        <article className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Ponte com a Ingresaas</h2>
              <p>A TCR já roda como filha oficial, mas continua governada pelo painel master.</p>
            </div>
          </div>
          <div className="permissionList">
            <p><strong>Painel master:</strong> cria clientes, acompanha relatórios e governa acessos.</p>
            <p><strong>TCR:</strong> vende, atende, faz check-in e opera a própria agenda.</p>
            <p><strong>Próximo uso ideal:</strong> sair da Ingresaas só para entrar aqui no ponto exato do trabalho.</p>
          </div>
        </article>
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
                {dashboard.periodMetrics.newCustomerOrders} pedido(s) • {dashboard.periodMetrics.newCustomerRate}%
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
            <p>Capacidade, vendidos, reservas e faturamento pago da operação atual.</p>
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
