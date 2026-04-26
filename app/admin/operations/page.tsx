import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import {
  createOrganizationAction,
  updateOrganizationAction,
  updateOrganizationStatusAction
} from "@/features/organizations/organization.actions";
import { listOrganizationsForPlatformAdmin } from "@/features/organizations/organization.admin.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type AdminOperationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    error?: string;
    created?: string;
    updated?: string;
  }>;
};

function statusLabel(status: string) {
  if (status === "active") {
    return "Somente ativas";
  }

  if (status === "inactive") {
    return "Somente inativas";
  }

  return "Todas";
}

function getOnboardingState(organization: {
  publicDomain: string | null;
  adminDomain: string | null;
  _count: { adminUsers: number; events: number };
  securityTone: string;
}) {
  if (
    organization.securityTone === "published" &&
    organization.publicDomain &&
    organization.adminDomain &&
    organization._count.adminUsers > 0 &&
    organization._count.events > 0
  ) {
    return {
      label: "Pronta para operar",
      note: "Domínio, acesso inicial e agenda já permitem revisão final.",
      tone: "published"
    };
  }

  if (organization.publicDomain && organization.adminDomain && organization._count.adminUsers > 0) {
    return {
      label: "Quase pronta",
      note: "Falta fechar agenda, branding fino ou suporte antes de soltar com menos supervisão.",
      tone: "pending"
    };
  }

  return {
    label: "Em implantação",
    note: "Ainda falta concluir domínio, acesso inicial ou base mínima da operação.",
    tone: "draft"
  };
}

export default async function AdminOperationsPage({ searchParams }: AdminOperationsPageProps) {
  await requirePermission("OPERATIONS");
  const organizationContext = await getCurrentOrganizationContext();

  if (!organizationContext.isPlatformHost) {
    redirect("/admin");
  }

  const params = searchParams ? await searchParams : {};
  const query = typeof params.q === "string" ? params.q : "";
  const status = params.status === "active" || params.status === "inactive" ? params.status : "all";
  const error = typeof params.error === "string" ? params.error : "";
  const created = typeof params.created === "string" ? params.created : "";
  const updated = typeof params.updated === "string" ? params.updated : "";
  const organizations = await listOrganizationsForPlatformAdmin({ query, status });
  const activeOrganizations = organizations.filter((organization) => organization.isActive);
  const totalRevenueInCents = organizations.reduce((total, organization) => total + organization.paidRevenueInCents, 0);
  const totalPaidOrders = organizations.reduce((total, organization) => total + organization.paidOrdersCount, 0);
  const totalLeads = organizations.reduce((total, organization) => total + organization.leadsCount, 0);
  const secureOrganizations = organizations.filter((organization) => organization.securityTone === "published");
  const operationsWithInitialTeam = organizations.filter((organization) => organization._count.adminUsers > 0);

  return (
    <AdminShell
      title="Operações"
      description="Cadastre clientes, ligue domínio e identidade, e acompanhe receita e saúde de cada operação em um só lugar."
    >
      {error ? <div className="errorBox spacedSection">{error}</div> : null}
      {created ? <div className="successBox spacedSection">Cliente criado: {created}</div> : null}
      {updated ? <div className="successBox spacedSection">{updated}</div> : null}

      <section className="platformOperationsHero spacedSection" aria-label="Visão geral das operações">
        <div>
          <span className="eyebrow">Mesa de controle</span>
          <h2>Uma tela só para criar cliente, revisar domínio e acompanhar o que cada bilheteria já está movimentando.</h2>
          <p>
            Aqui a Ingresaas deixa de ser conceito e vira operação. Você cria o cliente novo, entrega o acesso inicial
            e acompanha receita, pedidos e leads sem misturar as bases.
          </p>
        </div>
        <div className="platformOperationsHeroBadges">
          <span>{organizations.length} cliente(s)</span>
          <span>{statusLabel(status)}</span>
          {query ? <span>Busca: {query}</span> : null}
        </div>
      </section>

      <section className="grid dashboardGrid platformMasterSnapshot spacedSection" aria-label="Resumo operacional">
        <article className="card metric dashboardHeroMetric">
          <span className="muted">Clientes ativos</span>
          <strong>{activeOrganizations.length}</strong>
          <small>Bilheterias já liberadas para operar</small>
        </article>
        <article className="card metric">
          <span className="muted">Receita paga</span>
          <strong>{formatCurrency(totalRevenueInCents)}</strong>
          <small>Soma do faturamento confirmado das operações filtradas</small>
        </article>
        <article className="card metric">
          <span className="muted">Pedidos pagos</span>
          <strong>{totalPaidOrders}</strong>
          <small>Compras confirmadas nas operações filtradas</small>
        </article>
        <article className="card metric">
          <span className="muted">Leads</span>
          <strong>{totalLeads}</strong>
          <small>Captações já armazenadas nas operações filtradas</small>
        </article>
        <article className="card metric">
          <span className="muted">Base protegida</span>
          <strong>{secureOrganizations.length}</strong>
          <small>Operações com domínio, equipe e suporte minimamente fechados</small>
        </article>
        <article className="card metric">
          <span className="muted">Usuário inicial</span>
          <strong>{operationsWithInitialTeam.length}</strong>
          <small>Clientes que já têm acesso inicial criado</small>
        </article>
      </section>

      <section className="grid twoColumns spacedSection platformOperationsWorkspace">
        <form action={createOrganizationAction} className="card form platformOperationCreateCard">
          <div>
            <span className="eyebrow">Novo cliente</span>
            <h2>Criar bilheteria filha</h2>
            <p className="muted">Preencha o essencial: quem é o cliente, qual domínio ele vai usar e qual será a identidade dele.</p>
          </div>

          <div className="platformCreateHints">
            <span>Valida domínio duplicado</span>
            <span>Cria usuário inicial</span>
            <span>Entrega acesso separado</span>
          </div>

          <div className="platformCreateFlow">
            <div>
              <strong>1. Base do cliente</strong>
              <span>Nome, slug e domínios</span>
            </div>
            <div>
              <strong>2. Acesso inicial</strong>
              <span>Usuário, e-mail e senha</span>
            </div>
            <div>
              <strong>3. Identidade mínima</strong>
              <span>Cores, logo e suporte</span>
            </div>
          </div>

          <div className="grid twoColumns">
            <label className="field">
              <span>Nome da operação</span>
              <input name="name" placeholder="Ex.: TCR Ingressos" required />
            </label>

            <label className="field">
              <span>Slug interno</span>
              <input name="slug" placeholder="Ex.: tcr-ingressos" />
            </label>
          </div>

          <div className="grid twoColumns">
            <label className="field">
              <span>Domínio público</span>
              <input name="publicDomain" placeholder="Ex.: bilheteria.cliente.com.br" />
            </label>

            <label className="field">
              <span>Domínio admin</span>
              <input name="adminDomain" placeholder="Ex.: produtor.cliente.com.br" />
            </label>
          </div>

          <div className="grid twoColumns">
            <label className="field">
              <span>Nome do usuário inicial</span>
              <input name="ownerName" placeholder="Ex.: Ana Paula" required />
            </label>

            <label className="field">
              <span>E-mail do usuário inicial</span>
              <input name="ownerEmail" type="email" placeholder="Ex.: contato@cliente.com.br" required />
            </label>
          </div>

          <label className="field">
            <span>Senha inicial</span>
            <input name="ownerPassword" type="password" placeholder="No mínimo 8 caracteres" required />
          </label>

          <div className="grid twoColumns">
            <label className="field">
              <span>Cor principal</span>
              <input name="primaryColor" placeholder="Ex.: #1f5fbf" />
            </label>

            <label className="field">
              <span>Cor secundária</span>
              <input name="secondaryColor" placeholder="Ex.: #dce9ff" />
            </label>
          </div>

          <div className="grid twoColumns">
            <label className="field">
              <span>Logo (URL)</span>
              <input name="logoUrl" placeholder="Ex.: https://cdn.cliente.com/logo.png" />
            </label>

            <label className="field">
              <span>Contato de suporte</span>
              <input name="supportPhone" placeholder="Ex.: +55 11 99999-9999" />
            </label>
          </div>

          <label className="field">
            <span>E-mail de suporte</span>
            <input name="supportEmail" type="email" placeholder="Ex.: suporte@cliente.com.br" />
          </label>

          <button className="button" type="submit">
            Criar cliente
          </button>
        </form>

        <div className="platformOperationsRightColumn">
          <form className="card form platformOperationsFilterCard">
            <div>
              <span className="eyebrow">Relatório das operações</span>
              <h2>Filtrar clientes</h2>
              <p className="muted">Busque por nome ou domínio e veja só as bilheterias ativas ou inativas.</p>
            </div>

            <label className="field">
              <span>Buscar cliente</span>
              <input name="q" defaultValue={query} placeholder="Nome, slug, domínio ou e-mail de suporte" />
            </label>

            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={status}>
                <option value="all">Todas</option>
                <option value="active">Ativas</option>
                <option value="inactive">Inativas</option>
              </select>
            </label>

            <div className="actionRow">
              <button className="button" type="submit">
                Aplicar filtro
              </button>
              <Link className="secondaryButton" href="/admin/operations">
                Limpar
              </Link>
            </div>
          </form>

          <article className="card platformMasterGuide platformOperationsGuideCard">
            <span className="eyebrow">Segurança e governança</span>
            <ol className="platformChecklist">
              <li>O cliente nasce com login e senha iniciais próprios</li>
              <li>Domínio público e domínio admin ficam separados por operação</li>
              <li>Relatórios e configuração sensível não se misturam entre clientes</li>
              <li>A central da operação mostra o que ainda falta para liberar com segurança</li>
            </ol>
          </article>

          <article className="card platformMasterGuide platformOperationsGuideCard">
            <span className="eyebrow">Onboarding enxuto</span>
            <div className="permissionList">
              <p><strong>Passo 1:</strong> criar o cliente com domínio público e admin.</p>
              <p><strong>Passo 2:</strong> entregar o usuário inicial para o dono da operação.</p>
              <p><strong>Passo 3:</strong> revisar a central da operação e só depois entrar na rotina da filha.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Clientes da plataforma</h2>
            <p>Relatório por operação com receita, pedidos, leads, domínios e acesso rápido à central de gestão.</p>
          </div>
          <Link className="secondaryButton smallButton" href="/admin">
            Voltar ao painel master
          </Link>
        </div>

        {organizations.length === 0 ? (
          <div className="empty">Nenhuma operação encontrada com esse filtro.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Receita paga</th>
                  <th>Pedidos</th>
                  <th>Leads</th>
                  <th>Implantação</th>
                  <th>Segurança</th>
                  <th>Domínios</th>
                  <th>Atualizado</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization.id}>
                    <td>
                      <div className="tablePrimaryCell">
                        <strong>{organization.name}</strong>
                        <span>{organization.slug}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status ${organization.isActive ? "published" : "draft"}`}>
                        {organization.isActive ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td>{formatCurrency(organization.paidRevenueInCents)}</td>
                    <td>
                      <div className="tablePrimaryCell">
                        <strong>{organization.paidOrdersCount}</strong>
                        <span>{organization.totalOrdersCount} no total</span>
                      </div>
                    </td>
                    <td>{organization.leadsCount}</td>
                    <td>
                      {(() => {
                        const onboarding = getOnboardingState(organization);

                        return (
                          <div className="tablePrimaryCell">
                            <span className={`status ${onboarding.tone}`}>{onboarding.label}</span>
                            <span>{onboarding.note}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <div className="tablePrimaryCell">
                        <span className={`status ${organization.securityTone}`}>{organization.securityLabel}</span>
                        <span>{organization.securityIssues[0] || "Base mínima fechada"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="tablePrimaryCell">
                        <span>{organization.publicDomain || "Público pendente"}</span>
                        <span>{organization.adminDomain || "Admin pendente"}</span>
                      </div>
                    </td>
                    <td>{formatDateTime(organization.updatedAt)}</td>
                    <td>
                      <Link className="secondaryButton smallButton" href={`/admin/operations/${organization.id}`}>
                        Abrir central
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="operationsAdminList spacedSection">
        {organizations.map((organization) => (
          <article className="operationsAdminCard" key={organization.id}>
            <div className="operationsAdminCardHeader">
              <div>
                <strong>{organization.name}</strong>
                <span>{organization.slug}</span>
              </div>
              <span className={`status ${organization.isActive ? "published" : "draft"}`}>
                {organization.isActive ? "Ativa" : "Inativa"}
              </span>
            </div>

            {(() => {
              const onboarding = getOnboardingState(organization);

              return (
                <div className="operationsAdminOnboarding">
                  <span className={`status ${onboarding.tone}`}>{onboarding.label}</span>
                  <small>{onboarding.note}</small>
                </div>
              );
            })()}

            <div className="operationsAdminStats">
              <div>
                <span>Receita paga</span>
                <strong>{formatCurrency(organization.paidRevenueInCents)}</strong>
              </div>
              <div>
                <span>Pedidos pagos</span>
                <strong>{organization.paidOrdersCount}</strong>
              </div>
              <div>
                <span>Leads</span>
                <strong>{organization.leadsCount}</strong>
              </div>
              <div>
                <span>Prontidão</span>
                <strong>{organization.readinessScore}%</strong>
              </div>
              <div>
                <span>Segurança</span>
                <strong>{organization.securityLabel}</strong>
              </div>
            </div>

            <div className="operationsAdminLinks">
              <span>{organization.publicDomain || "Domínio público pendente"}</span>
              <span>{organization.adminDomain || "Domínio admin pendente"}</span>
            </div>

            <div className="operationsAdminSwatches">
              <span>
                <i style={{ background: organization.primaryColor || "#1f5fbf" }} />
                Principal
              </span>
              <span>
                <i style={{ background: organization.secondaryColor || "#dce9ff" }} />
                Secundária
              </span>
            </div>

            <div className="platformReadinessBar" aria-label={`Prontidão de ${organization.readinessScore}%`}>
              <span style={{ width: `${organization.readinessScore}%` }} />
            </div>

            <div className="operationsAdminSecurity">
              <span className={`status ${organization.securityTone}`}>{organization.securityLabel}</span>
              <div className="platformReadinessTags">
                {organization.securityIssues.length > 0 ? (
                  organization.securityIssues.map((issue) => (
                    <span className="isTodo" key={issue}>
                      {issue}
                    </span>
                  ))
                ) : (
                  <span className="isDone">Domínio, equipe e acesso inicial ok</span>
                )}
              </div>
            </div>

            <form action={updateOrganizationAction} className="operationsAdminForm">
              <input name="organizationId" type="hidden" value={organization.id} />

              <label className="field">
                <span>Nome</span>
                <input defaultValue={organization.name} name="name" required />
              </label>
              <label className="field">
                <span>Domínio público</span>
                <input defaultValue={organization.publicDomain ?? ""} name="publicDomain" />
              </label>
              <label className="field">
                <span>Domínio admin</span>
                <input defaultValue={organization.adminDomain ?? ""} name="adminDomain" />
              </label>
              <label className="field">
                <span>Logo (URL)</span>
                <input defaultValue={organization.logoUrl ?? ""} name="logoUrl" />
              </label>
              <label className="field">
                <span>Cor principal</span>
                <input defaultValue={organization.primaryColor ?? ""} name="primaryColor" />
              </label>
              <label className="field">
                <span>Cor secundária</span>
                <input defaultValue={organization.secondaryColor ?? ""} name="secondaryColor" />
              </label>
              <label className="field">
                <span>E-mail de suporte</span>
                <input defaultValue={organization.supportEmail ?? ""} name="supportEmail" />
              </label>
              <label className="field">
                <span>Telefone / WhatsApp</span>
                <input defaultValue={organization.supportPhone ?? ""} name="supportPhone" />
              </label>

              <div className="operationsAdminInlineActions">
                <button className="button smallButton" type="submit">
                  Salvar
                </button>
              </div>
            </form>

            <div className="operationsAdminCardFooter">
              <div className="operationsAdminQuickActions">
                <Link className="secondaryButton smallButton" href={`/admin/operations/${organization.id}`}>
                  Central
                </Link>
                <Link className="secondaryButton smallButton" href="/admin/users">
                  Usuários
                </Link>
                {organization.adminDomain ? (
                  <a
                    className="secondaryButton smallButton"
                    href={`https://${organization.adminDomain}/admin`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Admin
                  </a>
                ) : null}
              </div>

              <form action={updateOrganizationStatusAction} className="operationsAdminQuickActions">
                <input name="organizationId" type="hidden" value={organization.id} />
                <input name="isActive" type="hidden" value={organization.isActive ? "false" : "true"} />
                <button className="secondaryButton smallButton" type="submit">
                  {organization.isActive ? "Desativar" : "Ativar"}
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
