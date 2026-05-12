import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getDashboardMetrics } from "@/features/dashboard/dashboard.service";
import { getPlatformOverview } from "@/features/platform/platform.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

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

function formatDateRangeLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00-03:00`);
  const end = new Date(`${endDate}T00:00:00-03:00`);

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatKpiDelta(value: number) {
  const signal = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const prefix = value > 0 ? "+" : value < 0 ? "" : "";
  return {
    signal,
    label: `${prefix}${value.toFixed(1).replace(".", ",")}% vs período anterior`
  };
}

function formatPercentage(value: number, fractionDigits = 2) {
  return `${value.toFixed(fractionDigits).replace(".", ",")}%`;
}

function formatCompactDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function formatRelativeTime(value: Date) {
  const diffInMs = Date.now() - value.getTime();
  const diffInMinutes = Math.max(1, Math.round(diffInMs / 60000));

  if (diffInMinutes < 60) {
    return `Há ${diffInMinutes} min`;
  }

  const diffInHours = Math.round(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `Há ${diffInHours} h`;
  }

  const diffInDays = Math.round(diffInHours / 24);
  return `Há ${diffInDays} dia${diffInDays > 1 ? "s" : ""}`;
}

function humanizeOrderStatus(status: string) {
  if (status === "PAID") return "Pago";
  if (status === "PENDING_PAYMENT") return "Pendente";
  if (status === "REFUNDED") return "Reembolsado";
  if (status === "CANCELED") return "Cancelado";
  if (status === "EXPIRED") return "Expirado";
  return "Rascunho";
}

function humanizePaymentMethod(method: "PIX" | "CREDIT_CARD" | "SIMULATED" | "OTHER") {
  if (method === "PIX") return "Pix";
  if (method === "CREDIT_CARD") return "Cartão";
  if (method === "SIMULATED") return "Simulado";
  return "Outros";
}

function buildSalesChart(
  series: Array<{ label: string; revenueInCents: number; salesCount: number }>,
  maxRevenueInCents: number
) {
  const width = 640;
  const height = 280;
  const paddingLeft = 26;
  const paddingRight = 18;
  const paddingTop = 18;
  const paddingBottom = 34;
  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;
  const safeMax = maxRevenueInCents > 0 ? maxRevenueInCents : 1;

  const points = series.map((item, index) => {
    const x = paddingLeft + (usableWidth * index) / Math.max(1, series.length - 1);
    const y = paddingTop + usableHeight - (item.revenueInCents / safeMax) * usableHeight;
    return { ...item, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(height - paddingBottom).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - paddingBottom).toFixed(1)} Z`
    : "";

  return { width, height, paddingBottom, points, linePath, areaPath };
}

function buildXAxisDisplayLabels(series: Array<{ label: string }>) {
  const total = series.length;
  if (total <= 8) {
    return series.map((item) => item.label);
  }

  const step = total <= 14 ? 2 : total <= 24 ? 3 : total <= 40 ? 4 : 5;

  return series.map((item, index) => {
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const shouldShow = isFirst || isLast || index % step === 0;
    return shouldShow ? item.label : "";
  });
}

function DashboardIcon({
  kind
}: {
  kind:
    | "money"
    | "ticket"
    | "chart"
    | "users"
    | "repeat"
    | "percent"
    | "qr"
    | "clock"
    | "alert"
    | "activity";
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  if (kind === "money") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8" />
        <path d="M15 10.5c0-1.2-1.34-2.18-3-2.18s-3 .98-3 2.18 1.34 2.18 3 2.18 3 .98 3 2.18-1.34 2.18-3 2.18-3-.98-3-2.18" />
      </svg>
    );
  }

  if (kind === "ticket") {
    return (
      <svg {...common}>
        <path d="M4 9a2.5 2.5 0 0 0 0 6v3h16v-3a2.5 2.5 0 0 0 0-6V6H4z" />
        <path d="M9 8v8" />
      </svg>
    );
  }

  if (kind === "chart") {
    return (
      <svg {...common}>
        <path d="M6 18V9" />
        <path d="M12 18V6" />
        <path d="M18 18v-4" />
      </svg>
    );
  }

  if (kind === "users") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7.5" r="3.5" />
        <path d="M17 11a3 3 0 1 0 0-6" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    );
  }

  if (kind === "repeat") {
    return (
      <svg {...common}>
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11V9a3 3 0 0 1 3-3h15" />
        <path d="M7 22l-4-4 4-4" />
        <path d="M21 13v2a3 3 0 0 1-3 3H3" />
      </svg>
    );
  }

  if (kind === "percent") {
    return (
      <svg {...common}>
        <path d="M19 5L5 19" />
        <circle cx="7" cy="7" r="2.5" />
        <circle cx="17" cy="17" r="2.5" />
      </svg>
    );
  }

  if (kind === "qr") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <path d="M15 15h2v2h-2z" />
        <path d="M19 15h1v1h-1z" />
        <path d="M15 19h1v1h-1z" />
      </svg>
    );
  }

  if (kind === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }

  if (kind === "alert") {
    return (
      <svg {...common}>
        <path d="M12 3l9 16H3z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 14c2-1 4-3 5-6 1.5 3 3 5 6 6 2 1 4 1 5 1-1 2-3 4-5 5-2 1-4 1-6 0-2-1-4-3-5-5 1 0 3 0 5-1z" />
    </svg>
  );
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

          <article className="dashboardPanel platformMasterSectionCard">
            <span className="eyebrow">Comercial</span>
            <h2>Leads que chegaram pela home da Ingresaas.</h2>
            <p>
              Aqui fica a base inicial para o comercial puxar conversa com produtores que demonstraram
              interesse na bilheteria própria.
            </p>
            <div className="platformSecurityStack compact">
              <div>
                <span>Leads da plataforma</span>
                <strong>{platformOverview.totalPlatformLeads}</strong>
              </div>
              <div>
                <span>Último interesse</span>
                <strong>
                  {platformOverview.recentPlatformLeads[0]
                    ? formatDateTime(platformOverview.recentPlatformLeads[0].createdAt)
                    : "Sem registro ainda"}
                </strong>
              </div>
            </div>
          </article>
        </section>

        <section className="dashboardPanel spacedSection">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Leads comerciais recentes</h2>
              <p>Leads captados pela home pública da Ingresaas para o time comercial abordar.</p>
            </div>
          </div>

          {platformOverview.recentPlatformLeads.length === 0 ? (
            <p className="muted">Ainda não há leads comerciais registrados pela home da plataforma.</p>
          ) : (
            <div className="platformLeadAdminGrid">
              {platformOverview.recentPlatformLeads.map((lead) => (
                <article className="card platformLeadAdminCard" key={lead.id}>
                  <strong>{lead.name}</strong>
                  <span>{lead.email}</span>
                  <span>{lead.phone}</span>
                  <p>
                    <strong>Faturamento:</strong> {lead.annualRevenueBand}
                  </p>
                  <p>
                    <strong>Nicho:</strong> {lead.eventNiche}
                  </p>
                  <p>
                    <strong>Instagram:</strong> {lead.instagramHandle ? `@${lead.instagramHandle}` : "Não informado"}
                  </p>
                  <small>{formatDateTime(lead.createdAt)}</small>
                </article>
              ))}
            </div>
          )}
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

  const dashboard = await getDashboardMetrics(params, admin.organizationId, getAdminAllowedEventIds(admin));
  const periodLabel = formatPeriodLabel(dashboard.period.startDate, dashboard.period.endDate);
  const dateRangeLabel = formatDateRangeLabel(dashboard.period.startDate, dashboard.period.endDate);
  const salesChart = buildSalesChart(dashboard.salesByDay, dashboard.maxDailyRevenueInCents);
  const salesXAxisLabels = buildXAxisDisplayLabels(dashboard.salesByDay);
  const paymentMethodsChart = `conic-gradient(
    var(--admin-primary, #0b7a63) 0deg ${(dashboard.paymentMethods.pix.rate / 100) * 360}deg,
    #b8c4bf ${(dashboard.paymentMethods.pix.rate / 100) * 360}deg ${((dashboard.paymentMethods.pix.rate + dashboard.paymentMethods.card.rate) / 100) * 360}deg,
    #dfe6e2 ${((dashboard.paymentMethods.pix.rate + dashboard.paymentMethods.card.rate) / 100) * 360}deg 360deg
  )`;
  const customerMixChart = `conic-gradient(
    var(--admin-primary, #0b7a63) 0deg ${(dashboard.customers.newCustomerRate / 100) * 360}deg,
    #d4dad7 ${(dashboard.customers.newCustomerRate / 100) * 360}deg 360deg
  )`;
  const kpis = [
    {
      label: "Faturamento total",
      value: formatCurrency(dashboard.kpis.revenueInCents),
      delta: formatKpiDelta(dashboard.kpis.revenueChangePercent),
      icon: "money" as const
    },
    {
      label: "Vendas realizadas",
      value: dashboard.kpis.paidOrders,
      delta: formatKpiDelta(dashboard.kpis.paidOrdersChangePercent),
      icon: "ticket" as const
    },
    {
      label: "Ticket médio",
      value: formatCurrency(dashboard.kpis.averageTicketInCents),
      delta: formatKpiDelta(dashboard.kpis.averageTicketChangePercent),
      icon: "chart" as const
    },
    {
      label: "Novos clientes",
      value: dashboard.kpis.newCustomers,
      delta: formatKpiDelta(dashboard.kpis.newCustomersChangePercent),
      icon: "users" as const
    },
    {
      label: "Clientes recorrentes",
      value: dashboard.kpis.recurringCustomers,
      delta: formatKpiDelta(dashboard.kpis.recurringCustomersChangePercent),
      icon: "repeat" as const
    },
    {
      label: "Taxa de conversão",
      value: formatPercentage(dashboard.kpis.conversionRate),
      delta: formatKpiDelta(dashboard.kpis.conversionRateChangePercent),
      icon: "percent" as const
    }
  ];

  return (
    <AdminShell
      title="Dashboard geral"
      description="Visão completa da sua bilheteria, com foco em faturamento, pedidos, eventos e operação."
    >
      <div className="dashboardGeneralShell">
        <section className="dashboardGeneralTopbar" aria-label="Comandos do dashboard">
          <div className="dashboardGeneralTopbarMenu" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <form action="/admin/support" className="dashboardGeneralSearch">
            <div className="dashboardGeneralSearchIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </div>
            <input name="q" placeholder="Buscar eventos, pedidos, clientes..." />
            <span className="dashboardGeneralSearchHint">⌘ K</span>
          </form>

          <div className="dashboardGeneralUserBar">
            <div className="dashboardGeneralUserCard">
              <div className="dashboardGeneralAvatar">{admin.name.slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{admin.name}</strong>
                <span>{admin.role === "OWNER" ? "Administrador" : "Equipe da operação"}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboardGeneralHeader">
          <div>
            <h1>Dashboard geral</h1>
            <p>Visão completa da sua bilheteria</p>
          </div>

          <form className="dashboardGeneralDateCard">
            <div className="dashboardGeneralDateSummary">
              <span>{dateRangeLabel}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path d="M16 2v4" />
                <path d="M8 2v4" />
                <path d="M3 10h18" />
              </svg>
            </div>
            <div className="dashboardGeneralDateFields">
              <label>
                <span>Início</span>
                <input type="date" name="startDate" defaultValue={dashboard.period.startDate} />
              </label>
              <label>
                <span>Fim</span>
                <input type="date" name="endDate" defaultValue={dashboard.period.endDate} />
              </label>
              <button className="button smallButton" type="submit">
                Atualizar
              </button>
            </div>
          </form>
        </section>

        <section className="dashboardGeneralKpiGrid" aria-label="Indicadores principais">
          {kpis.map((item) => (
            <article className="dashboardGeneralKpiCard" key={item.label}>
              <span className="dashboardGeneralKpiIcon">
                <DashboardIcon kind={item.icon} />
              </span>
              <span className="dashboardGeneralKpiLabel">{item.label}</span>
              <strong>{item.value}</strong>
              <small className={`dashboardGeneralDelta is-${item.delta.signal}`}>{item.delta.label}</small>
            </article>
          ))}
        </section>

        <section className="dashboardGeneralMainGrid">
          <article className="dashboardGeneralPanel dashboardGeneralChartPanel">
            <div className="dashboardGeneralPanelHeader">
              <div>
                <h2>Vendas por dia</h2>
                <p>{periodLabel}</p>
              </div>
              <span className="dashboardGeneralPill">
                {dashboard.salesByDay.length <= 7 ? "Últimos 7 dias" : `${dashboard.salesByDay.length} dias`}
              </span>
            </div>

            <div className="dashboardGeneralLineChartWrap">
              <div className="dashboardGeneralYAxis">
                {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                  <span key={ratio}>{formatCurrency(Math.round(dashboard.maxDailyRevenueInCents * ratio))}</span>
                ))}
              </div>
              <div className="dashboardGeneralLineChart">
                <svg viewBox={`0 0 ${salesChart.width} ${salesChart.height}`} preserveAspectRatio="none">
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = 18 + (salesChart.height - 52) * ratio;
                    return <line className="dashboardGeneralGridLine" key={ratio} x1="26" x2="622" y1={y} y2={y} />;
                  })}
                  <path className="dashboardGeneralAreaPath" d={salesChart.areaPath} />
                  <path className="dashboardGeneralLinePath" d={salesChart.linePath} />
                  {salesChart.points.map((point, index) => (
                    <circle className="dashboardGeneralLinePoint" cx={point.x} cy={point.y} key={`${point.label}-${index}`} r="5.5" />
                  ))}
                </svg>
                <div
                  className="dashboardGeneralChartHotspots"
                  style={{ gridTemplateColumns: `repeat(${Math.max(dashboard.salesByDay.length, 1)}, minmax(0, 1fr))` }}
                >
                  {dashboard.salesByDay.map((item, index) => (
                    <button
                      aria-label={`${item.label}: ${item.salesCount} venda(s), ${formatCurrency(item.revenueInCents)}`}
                      className="dashboardGeneralChartHotspot"
                      key={`${item.date}-${index}-hotspot`}
                      type="button"
                    >
                      <span className="dashboardGeneralChartTooltip">
                        <strong>{item.label}</strong>
                        <small>{item.salesCount} venda(s) faturada(s)</small>
                        <small>{formatCurrency(item.revenueInCents)}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div
                  className="dashboardGeneralXAxis"
                  style={{ gridTemplateColumns: `repeat(${Math.max(dashboard.salesByDay.length, 1)}, minmax(0, 1fr))` }}
                >
                  {dashboard.salesByDay.map((item, index) => (
                    <span key={item.date}>{salesXAxisLabels[index]}</span>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="dashboardGeneralPanel">
            <div className="dashboardGeneralPanelHeader">
              <div>
                <h2>Meios de pagamento</h2>
                <p>Composição da receita paga</p>
              </div>
            </div>

            <div className="dashboardGeneralPaymentGrid">
              <div className="dashboardGeneralDonut" style={{ background: paymentMethodsChart }}>
                <span />
              </div>
              <div className="dashboardGeneralPaymentLegend">
                {[
                  {
                    label: "Pix",
                    colorClass: "is-pix",
                    value: dashboard.paymentMethods.pix.revenueInCents,
                    rate: dashboard.paymentMethods.pix.rate
                  },
                  {
                    label: "Cartão de crédito",
                    colorClass: "is-card",
                    value: dashboard.paymentMethods.card.revenueInCents,
                    rate: dashboard.paymentMethods.card.rate
                  },
                  {
                    label: "Outros",
                    colorClass: "is-other",
                    value: dashboard.paymentMethods.other.revenueInCents,
                    rate: dashboard.paymentMethods.other.rate
                  }
                ].map((item) => (
                  <div className="dashboardGeneralLegendRow" key={item.label}>
                    <div>
                      <i className={item.colorClass} />
                      <span>{item.label}</span>
                    </div>
                    <strong>{formatCurrency(item.value)}</strong>
                    <small>{formatPercentage(item.rate, 1)}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboardGeneralTotalsFooter">
              <span>Total</span>
              <strong>{formatCurrency(dashboard.paymentMethods.totalRevenueInCents)}</strong>
            </div>
          </article>
        </section>

        <section className="dashboardGeneralMidGrid">
          <article className="dashboardGeneralPanel">
            <div className="dashboardGeneralPanelHeader">
              <div>
                <h2>Performance dos eventos</h2>
                <p>Os eventos que mais puxaram receita no período.</p>
              </div>
            </div>

            {dashboard.eventPerformance.length === 0 ? (
              <div className="empty">Nenhuma venda paga no período selecionado.</div>
            ) : (
              <>
                <div className="dashboardGeneralEventTable">
                  <div className="dashboardGeneralEventTableHead">
                    <span>Evento</span>
                    <span>Vendas</span>
                    <span>Receita</span>
                    <span>Conversão</span>
                  </div>
                  {dashboard.eventPerformance.map((event) => (
                    <Link className="dashboardGeneralEventRow" href={`/admin/events/${event.id}`} key={event.id}>
                      <div className="dashboardGeneralEventCell">
                        <span className="dashboardGeneralEventThumb">
                          {event.bannerUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt={event.title} src={event.bannerUrl} />
                          ) : (
                            <b>{event.title.slice(0, 1).toUpperCase()}</b>
                          )}
                        </span>
                        <strong>{event.title}</strong>
                      </div>
                      <span>{event.periodSalesCount}</span>
                      <span>{formatCurrency(event.periodRevenueInCents)}</span>
                      <span>{formatPercentage(event.conversionRate)}</span>
                    </Link>
                  ))}
                </div>
                <Link className="dashboardGeneralGhostLink" href="/admin/events">
                  Ver todos os eventos
                </Link>
              </>
            )}
          </article>

          <article className="dashboardGeneralPanel">
            <div className="dashboardGeneralPanelHeader">
              <div>
                <h2>Funil de vendas</h2>
                <p>Leitura rápida do avanço até a compra.</p>
              </div>
            </div>

            <div className="dashboardGeneralFunnel">
              <div className="dashboardGeneralFunnelStep is-light">
                <span>Visitantes</span>
                <strong>{dashboard.funnel.visitors.toLocaleString("pt-BR")}</strong>
              </div>
              <div className="dashboardGeneralFunnelStep is-mid">
                <span>Iniciaram compra</span>
                <strong>{dashboard.funnel.startedCheckout.toLocaleString("pt-BR")}</strong>
              </div>
              <div className="dashboardGeneralFunnelStep is-dark">
                <span>Compraram</span>
                <strong>{dashboard.funnel.purchased.toLocaleString("pt-BR")}</strong>
              </div>
            </div>

            <div className="dashboardGeneralFunnelRate">
              <span>Taxa de conversão</span>
              <strong>{formatPercentage(dashboard.funnel.conversionRate)}</strong>
            </div>
          </article>
        </section>

        <section className="dashboardGeneralOpsGrid">
          <article className="dashboardGeneralPanel">
            <div className="dashboardGeneralPanelHeader">
              <div>
                <h2>Check-in & Operação</h2>
                <p>Resumo rápido do que já foi emitido e usado.</p>
              </div>
            </div>

            <div className="dashboardGeneralOperationList">
              <div className="dashboardGeneralOperationItem">
                <div>
                  <span>Ingressos emitidos</span>
                  <strong>{dashboard.operations.ticketsIssued.toLocaleString("pt-BR")}</strong>
                </div>
                <i><DashboardIcon kind="qr" /></i>
              </div>
              <div className="dashboardGeneralOperationItem">
                <div>
                  <span>Check-ins realizados</span>
                  <strong>{dashboard.operations.checkInsApproved.toLocaleString("pt-BR")}</strong>
                </div>
                <i><DashboardIcon kind="activity" /></i>
              </div>
              <div className="dashboardGeneralOperationItem">
                <div>
                  <span>Pendentes</span>
                  <strong>{Math.max(0, dashboard.operations.pendingOrders).toLocaleString("pt-BR")}</strong>
                </div>
                <i><DashboardIcon kind="clock" /></i>
              </div>
            </div>
          </article>

          <article className="dashboardGeneralPanel">
            <div className="dashboardGeneralPanelHeader">
              <div>
                <h2>Novos vs. recorrentes</h2>
                <p>Quem está chegando agora e quem voltou a comprar.</p>
              </div>
            </div>

            <div className="dashboardGeneralCustomerMix">
              <div className="dashboardGeneralCustomerStats">
                <div>
                  <strong>{formatPercentage(dashboard.customers.newCustomerRate, 0)}</strong>
                  <span>Novos clientes</span>
                  <small>{dashboard.customers.newCustomers}</small>
                </div>
                <div>
                  <strong>{formatPercentage(dashboard.customers.recurringCustomerRate, 0)}</strong>
                  <span>Recorrentes</span>
                  <small>{dashboard.customers.recurringCustomers}</small>
                </div>
              </div>
              <div className="dashboardGeneralDonut is-small" style={{ background: customerMixChart }}>
                <span />
              </div>
            </div>
          </article>

          <article className="dashboardGeneralPanel">
            <div className="dashboardGeneralPanelHeader">
              <div>
                <h2>Top locais</h2>
                <p>Praças que mais geraram venda aprovada.</p>
              </div>
            </div>

            <div className="dashboardGeneralLocationList">
              {dashboard.topLocations.length === 0 ? (
                <div className="empty">Sem local suficiente no período.</div>
              ) : (
                dashboard.topLocations.map((item) => (
                  <div className="dashboardGeneralLocationRow" key={item.label}>
                    <div className="dashboardGeneralLocationMeta">
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="dashboardGeneralLocationBar">
                      <span style={{ width: `${Math.max(item.rate, 4)}%` }} />
                    </div>
                    <small>{formatPercentage(item.rate, 0)}</small>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <section className="dashboardGeneralBottomGrid">
          <article className="dashboardGeneralPanel">
            <div className="dashboardGeneralPanelHeader">
              <div>
                <h2>Pedidos recentes</h2>
                <p>Últimas compras e movimentações do caixa.</p>
              </div>
              <Link className="dashboardGeneralGhostLink compact" href="/admin/orders">
                Ver todos os pedidos
              </Link>
            </div>

            <div className="tableScroll wideTableScroll">
              <table className="table dashboardGeneralOrdersTable">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Evento</th>
                    <th>Status</th>
                    <th>Pagamento</th>
                    <th>Total</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty">Nenhum pedido desta operação ainda.</div>
                      </td>
                    </tr>
                  ) : (
                    dashboard.recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/admin/orders/${order.code}`}>
                            <strong>{order.code}</strong>
                          </Link>
                        </td>
                        <td>{order.customer.name}</td>
                        <td>{order.event.title}</td>
                        <td>
                          <span className={`status ${order.status === "PAID" ? "published" : order.status === "REFUNDED" ? "pending" : "draft"}`}>
                            {humanizeOrderStatus(order.status)}
                          </span>
                        </td>
                        <td>
                          {humanizePaymentMethod(
                            order.payment?.provider === "ASAAS" && order.payment?.pixQrCodePayload
                              ? "PIX"
                              : order.payment?.provider === "MERCADO_PAGO" || order.payment?.provider === "PAGARME"
                                ? "CREDIT_CARD"
                                : order.payment?.provider === "SIMULATED"
                                  ? "SIMULATED"
                                  : "OTHER"
                          )}
                        </td>
                        <td>{formatCurrency(order.totalInCents)}</td>
                        <td>{formatCompactDateTime(order.paidAt ?? order.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="dashboardGeneralPanel">
            <div className="dashboardGeneralPanelHeader">
              <div>
                <h2>Atividades recentes</h2>
                <p>O que acabou de acontecer na operação.</p>
              </div>
            </div>

            <div className="dashboardGeneralActivityList">
              {dashboard.recentActivities.length === 0 ? (
                <div className="empty">Nenhuma atividade desta operação ainda.</div>
              ) : (
                dashboard.recentActivities.map((activity) => (
                  <article className="dashboardGeneralActivityItem" key={activity.id}>
                    <i>
                      <DashboardIcon
                        kind={
                          activity.title.includes("Venda")
                            ? "money"
                            : activity.title.includes("Check-in")
                              ? "qr"
                              : activity.title.includes("Reembolso")
                                ? "alert"
                                : "users"
                        }
                      />
                    </i>
                    <div>
                      <strong>{activity.title}</strong>
                      <span>{activity.subtitle}</span>
                      <small>{activity.meta}</small>
                    </div>
                    <time>{formatRelativeTime(activity.happenedAt)}</time>
                  </article>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </AdminShell>
  );
}
