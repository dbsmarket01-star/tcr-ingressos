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
    const operationsWithInitialTeam = activeOperations.filter((item) => item.adminCount > 0).length;
    const operationsWithFullDomains = activeOperations.filter((item) => item.publicDomain && item.adminDomain).length;
    const operationsWithSecurityBase = activeOperations.filter(
      (item) => item.adminCount > 0 && item.publicDomain && item.adminDomain
    ).length;

    return (
      <AdminShell
        title="Ingresaas"
        description="Painel master da plataforma, com leitura consolidada das bilheterias filhas, domínios e equipe."
      >
        <section className="platformOverviewPanel spacedSection" aria-label="Resumo da plataforma">
          <div className="platformOverviewHero">
            <div>
              <span className="eyebrow">Painel master</span>
              <h2>Uma central mais limpa para criar clientes, proteger acessos e administrar a base inteira sem ruído.</h2>
              <p>
                A Ingresaas fica no topo do guarda-chuva. Cada bilheteria filha entra com login e senha próprios,
                carrega seu domínio e mantém dados, equipe e relatórios separados.
              </p>
            </div>
            <div className="platformOverviewBadges">
              <span>Cliente novo</span>
              <span>Acesso separado</span>
              <span>Domínio próprio</span>
            </div>
          </div>

          <div className="grid dashboardGrid platformOverviewMetrics">
            {metric("Operações", platformOverview.childOrganizations, "Bilheterias filhas cadastradas")}
            {metric("Ativas", platformOverview.activeOrganizations, `${platformOverview.fullyConfiguredOrganizations} com público + admin completos`, true)}
            {metric("Eventos publicados", platformOverview.publishedEvents, "Eventos ativos nas operações")}
            {metric("Equipe somada", platformOverview.totalAdmins, "Usuários internos cadastrados")}
          </div>

          <div className="platformMasterActionBar">
            <Link className="button smallButton" href="/admin/operations">
              Abrir operações
            </Link>
          </div>
        </section>

        <section className="platformExecutiveGrid spacedSection" aria-label="Leitura rápida da plataforma">
          <article className="dashboardPanel platformExecutiveCard">
            <span className="eyebrow">Acesso do cliente</span>
            <h2>{operationsWithInitialTeam} operação(ões) já têm equipe inicial pronta para entrar.</h2>
            <p>O cliente nasce com usuário inicial, depois a equipe cresce dentro da própria bilheteria, sem cruzar acessos.</p>
          </article>

          <article className="dashboardPanel platformExecutiveCard">
            <span className="eyebrow">Segurança da base</span>
            <h2>{operationsWithSecurityBase} operação(ões) já têm domínio e acesso administrativo fechados.</h2>
            <p>Essa é a base mínima para o cliente operar com separação entre público, admin e governança master.</p>
          </article>
        </section>

        <section className="platformSecurityGrid spacedSection" aria-label="Acesso e segurança da plataforma">
          <article className="dashboardPanel platformSecurityCard">
            <span className="eyebrow">Login e senha dos clientes</span>
            <h2>Cada cliente entra no próprio admin, com usuário inicial criado junto da operação.</h2>
            <p>
              O fluxo fica simples: você cria o cliente, define domínio, identidade e usuário inicial. Depois disso, o
              próprio cliente passa a operar a equipe dele lá dentro.
            </p>
            <div className="platformSecurityStack">
              <div>
                <span>Clientes ativos</span>
                <strong>{activeOperations.length}</strong>
              </div>
              <div>
                <span>Com equipe inicial</span>
                <strong>{operationsWithInitialTeam}</strong>
              </div>
              <div>
                <span>Com domínio admin</span>
                <strong>{operationsWithFullDomains}</strong>
              </div>
            </div>
          </article>

          <article className="dashboardPanel platformSecurityCard">
            <span className="eyebrow">Segurança e governança</span>
            <h2>Dados, relatórios e configurações sensíveis continuam isolados por operação.</h2>
            <p>
              A Ingresaas governa a base toda, mas o cliente só enxerga a própria bilheteria. Isso mantém números,
              equipe, eventos e configuração separados mesmo com um motor único embaixo.
            </p>
            <div className="platformSecurityList">
              <span>Domínio público separado</span>
              <span>Admin separado</span>
              <span>Usuários por cliente</span>
              <span>Permissões por papel</span>
            </div>
          </article>
        </section>

        <section className="platformAccessWorkflow spacedSection" aria-label="Fluxo de acesso e proteção">
          <article className="dashboardPanel platformAccessWorkflowCard">
            <span className="eyebrow">Fluxo de criação</span>
            <h2>Crie o cliente uma vez e entregue uma entrada limpa para ele operar.</h2>
            <ol className="platformChecklist">
              <li>Cadastre nome, domínio público e domínio admin</li>
              <li>Defina as cores e a identidade mínima da operação</li>
              <li>Crie o usuário inicial com login e senha</li>
              <li>Abra a central da operação e revise equipe, eventos e pedidos</li>
            </ol>
          </article>

          <article className="dashboardPanel platformAccessWorkflowCard">
            <span className="eyebrow">Proteção de acesso</span>
            <h2>Uma camada simples para não misturar plataforma, cliente e rotina operacional.</h2>
            <div className="platformProtectionList">
              <div>
                <strong>Master</strong>
                <p>Cria clientes, governa domínios e acompanha a saúde das operações.</p>
              </div>
              <div>
                <strong>Cliente</strong>
                <p>Entra no admin da própria bilheteria e cuida de equipe, eventos e vendas.</p>
              </div>
              <div>
                <strong>Papel restrito</strong>
                <p>Pode operar só os eventos ou áreas que você liberar, sem abrir a base inteira.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="grid twoColumns spacedSection">
          <article className="dashboardPanel platformMasterGuide">
            <div className="sectionHeader inlineHeader">
              <div>
                <h2>Fluxo de implantação</h2>
                <p>O caminho mínimo para um cliente nascer dentro da Ingresaas sem bagunça.</p>
              </div>
            </div>
            <ol className="platformChecklist">
              <li>Criar o cliente com domínio, identidade e usuário inicial</li>
              <li>Apontar domínio público e domínio do produtor</li>
              <li>Entrar na central da operação e revisar eventos, pedidos e check-in</li>
              <li>Conferir relatórios da filha sem misturar dados de outra operação</li>
            </ol>
          </article>

          <article className="dashboardPanel platformMasterGuide">
            <div className="sectionHeader inlineHeader">
              <div>
                <h2>Estrutura da plataforma</h2>
                <p>O que precisa continuar separado para a Ingresaas crescer sem virar bagunça.</p>
              </div>
            </div>
            <div className="permissionList">
              <p>
                <strong>Ingresaas:</strong> domínio institucional, login master e gestão das bilheterias filhas.
              </p>
              <p>
                <strong>Bilheteria filha:</strong> domínio público para cliente final e domínio admin para produtores.
              </p>
              <p>
                <strong>Branding:</strong> cada operação precisa refletir suas próprias cores, suporte e linguagem.
              </p>
              <p>
                <strong>Base única:</strong> o motor técnico continua compartilhado, sem clonar código ou banco.
              </p>
            </div>
          </article>
        </section>

        <section className="grid dashboardGrid platformMasterSnapshot spacedSection" aria-label="Próximos movimentos da plataforma">
          {metric("Prontas para operar", platformOverview.operations.filter((item) => item.readinessScore >= 67).length, "Operações com estrutura suficiente para revisão final")}
          {metric("Ainda montando base", platformOverview.operations.filter((item) => item.readinessScore < 67).length, "Dependem de domínio, branding ou equipe")}
          {metric("Eventos publicados", platformOverview.publishedEvents, "Já ativos em alguma bilheteria filha")}
          {metric("Domínios completos", platformOverview.fullyConfiguredOrganizations, "Público + admin cadastrados")}
        </section>

        <section className="dashboardPanel platformOperationsPanel spacedSection">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Resumo das operações</h2>
              <p>Clientes já cadastrados com sinais rápidos de receita, equipe, domínio e prontidão.</p>
            </div>
            <Link className="button" href="/admin/operations">
              Ver relatório por operação
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
      description="Acompanhe faturamento, pedidos, meios de pagamento e desempenho dos eventos por período."
    >
      <section className="operationCommandStrip spacedSection" aria-label="Atalhos da operação">
        <article className="operationCommandCard">
          <span className="eyebrow">Rotina da operação</span>
          <h2>{organizationContext.brandName} em visão rápida</h2>
          <p>Use estes atalhos para sair do panorama geral e cair direto nas áreas mais operacionais da filha.</p>
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
          <h2>Resumo da operação</h2>
          <p>{periodLabel}. Ajuste as datas para comparar vendas, clientes e desempenho por evento.</p>
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
