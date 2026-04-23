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
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage() {
  await requirePermission("OPERATIONS");
  const organizationContext = await getCurrentOrganizationContext();

  if (!organizationContext.isPlatformHost) {
    redirect("/admin");
  }

  const organizations = await listOrganizationsForPlatformAdmin();
  const activeOrganizations = organizations.filter((organization) => organization.isActive);
  const readyOrganizations = organizations.filter((organization) => organization.readinessScore >= 67);

  return (
    <AdminShell
      title="Operações"
      description="Cadastre e organize as bilheterias filhas da Ingresaas, com domínio, equipe e operação separados."
    >
      <section className="platformOperationsHero spacedSection" aria-label="Visão geral das operações">
        <div>
          <span className="eyebrow">Gestão das bilheterias filhas</span>
          <h2>Cadastre, prepare e acompanhe cada operação a partir do painel master.</h2>
          <p>
            Esta é a mesa de controle da Ingresaas. Aqui você liga domínio, branding, equipe e suporte antes de a
            bilheteria filha entrar em operação pública.
          </p>
        </div>
        <div className="platformOperationsHeroBadges">
          <span>Domínio público</span>
          <span>Domínio admin</span>
          <span>Branding por operação</span>
          <span>Onboarding guiado</span>
        </div>
      </section>

      <section className="grid dashboardGrid platformMasterSnapshot spacedSection" aria-label="Resumo operacional">
        <article className="card metric dashboardHeroMetric">
          <span className="muted">Operações cadastradas</span>
          <strong>{organizations.length}</strong>
          <small>Base total da plataforma</small>
        </article>
        <article className="card metric">
          <span className="muted">Ativas</span>
          <strong>{activeOrganizations.length}</strong>
          <small>Já liberadas para uso</small>
        </article>
        <article className="card metric">
          <span className="muted">Prontas para revisar</span>
          <strong>{readyOrganizations.length}</strong>
          <small>Com estrutura suficiente para avançar</small>
        </article>
        <article className="card metric">
          <span className="muted">Ainda montando base</span>
          <strong>{organizations.length - readyOrganizations.length}</strong>
          <small>Dependem de domínio, equipe ou branding</small>
        </article>
      </section>

      <section className="grid twoColumns">
        <form action={createOrganizationAction} className="card form platformOperationCreateCard">
          <div>
            <span className="eyebrow">Nova operação</span>
            <h2>Criar uma nova bilheteria filha</h2>
            <p className="muted">
              Use esta etapa para preparar a próxima operação antes de apontar o domínio real dela.
            </p>
          </div>

          <div className="platformCreateHints">
            <span>Comece pelo nome e domínios</span>
            <span>Defina branding mínimo</span>
            <span>Depois libere equipe e evento piloto</span>
          </div>

          <label className="field">
            <span>Nome da operação</span>
            <input name="name" placeholder="Ex.: A2 imergidos" required />
          </label>

          <label className="field">
            <span>Slug interno</span>
            <input name="slug" placeholder="Ex.: a2-imergidos" />
          </label>

          <label className="field">
            <span>Domínio público</span>
            <input name="publicDomain" placeholder="Ex.: a2ingressos.app.br" />
          </label>

          <label className="field">
            <span>Domínio admin</span>
            <input name="adminDomain" placeholder="Ex.: produtor.a2ingressos.app.br" />
          </label>

          <label className="field">
            <span>Logo (URL)</span>
            <input name="logoUrl" placeholder="Ex.: https://cdn.seudominio.com/logo.png" />
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

          <label className="field">
            <span>E-mail de suporte</span>
            <input name="supportEmail" type="email" placeholder="Ex.: suporte@a2ingressos.app.br" />
          </label>

          <label className="field">
            <span>WhatsApp / telefone</span>
            <input name="supportPhone" placeholder="Ex.: +55 11 99999-9999" />
          </label>

          <button className="button" type="submit">
            Criar operação
          </button>
        </form>

        <section className="card platformArchitectureCard">
          <span className="eyebrow">Leitura da arquitetura</span>
          <h2>Como a Ingresaas vai crescer</h2>
          <div className="permissionList">
            <p>
              <strong>Ingresaas:</strong> a plataforma-mãe que administra o motor SaaS.
            </p>
            <p>
              <strong>Operação filha:</strong> uma bilheteria com marca, domínio, equipe e eventos próprios.
            </p>
            <p>
              <strong>Primeira filha:</strong> a base atual pode ser refinada aqui antes de nascer a próxima operação.
            </p>
            <p>
              <strong>Escala:</strong> novas bilheterias entram pela mesma tela, depois recebem domínio, branding e equipe.
            </p>
          </div>
        </section>
      </section>

      <section className="grid twoColumns spacedSection">
        <article className="dashboardPanel platformMasterGuide">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Checklist de onboarding</h2>
              <p>Use esta ordem para cada operação nova nascer com menos dependência manual.</p>
            </div>
          </div>
          <ol className="platformChecklist">
            <li>Cadastrar nome, domínio público e domínio admin</li>
            <li>Definir cores, logo e suporte</li>
            <li>Criar usuário proprietário da operação</li>
            <li>Publicar primeiro evento e revisar a home da bilheteria</li>
            <li>Testar pedido, e-mail, ingresso e check-in no domínio certo</li>
          </ol>
        </article>

        <article className="dashboardPanel platformMasterGuide">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Padrão de domínio</h2>
              <p>Estrutura recomendada para manter o SaaS limpo e previsível.</p>
            </div>
          </div>
          <div className="permissionList">
            <p>
              <strong>Master:</strong> ingresaas.app.br
            </p>
            <p>
              <strong>Público da operação:</strong> bilheteria no domínio do cliente final
            </p>
            <p>
              <strong>Admin da operação:</strong> produtor.seudominio.com.br
            </p>
            <p>
              <strong>Suporte:</strong> cada operação mantém seu e-mail e WhatsApp próprios
            </p>
          </div>
        </article>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Operações cadastradas</h2>
            <p>Edite dados básicos, confira domínios e mantenha o status das operações sob controle.</p>
          </div>
          <div className="platformSectionActions">
            <Link className="secondaryButton smallButton" href="/admin">
              Voltar ao painel master
            </Link>
          </div>
        </div>

        <div className="operationsAdminList">
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

              <div className="operationsAdminStats">
                <div>
                  <span>Eventos</span>
                  <strong>{organization._count.events}</strong>
                </div>
                <div>
                  <span>Equipe</span>
                  <strong>{organization._count.adminUsers}</strong>
                </div>
                <div>
                  <span>Criada em</span>
                  <strong>{formatDateTime(organization.createdAt)}</strong>
                </div>
                <div>
                  <span>Prontidão</span>
                  <strong>{organization.readinessScore}%</strong>
                </div>
              </div>

              <div className="operationsAdminLinks">
                <span>{organization.publicDomain || "Domínio público pendente"}</span>
                <span>{organization.adminDomain || "Domínio admin pendente"}</span>
              </div>

              <div className="operationsAdminQuickActions">
                <Link className="secondaryButton smallButton" href={`/admin/operations/${organization.id}`}>
                  Central da operação
                </Link>
                {organization.adminDomain ? (
                  <a
                    className="secondaryButton smallButton"
                    href={`https://${organization.adminDomain}/admin`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Entrar no admin
                  </a>
                ) : null}
                {organization.publicDomain ? (
                  <a
                    className="secondaryButton smallButton"
                    href={`https://${organization.publicDomain}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir vitrine
                  </a>
                ) : null}
              </div>

              <div className="operationsAdminSwatches">
                <span>
                  <i style={{ background: organization.primaryColor || "#0b7a63" }} />
                  Principal
                </span>
                <span>
                  <i style={{ background: organization.secondaryColor || "#dff3ec" }} />
                  Secundária
                </span>
              </div>

              <div className="platformReadinessBar" aria-label={`Prontidão de ${organization.readinessScore}%`}>
                <span style={{ width: `${organization.readinessScore}%` }} />
              </div>

              <div className="platformReadinessTags">
                {organization.readinessItems.map((item) => (
                  <span className={item.done ? "isDone" : "isTodo"} key={item.label}>
                    {item.label}
                  </span>
                ))}
              </div>

              <form action={updateOrganizationAction} className="operationsAdminForm">
                <input type="hidden" name="organizationId" value={organization.id} />

                <label className="field">
                  <span>Nome</span>
                  <input name="name" defaultValue={organization.name} required />
                </label>

                <label className="field">
                  <span>Domínio público</span>
                  <input name="publicDomain" defaultValue={organization.publicDomain || ""} />
                </label>

                <label className="field">
                  <span>Domínio admin</span>
                  <input name="adminDomain" defaultValue={organization.adminDomain || ""} />
                </label>

                <label className="field">
                  <span>Logo (URL)</span>
                  <input name="logoUrl" defaultValue={organization.logoUrl || ""} />
                </label>

                <label className="field">
                  <span>Cor principal</span>
                  <input name="primaryColor" defaultValue={organization.primaryColor || ""} />
                </label>

                <label className="field">
                  <span>Cor secundária</span>
                  <input name="secondaryColor" defaultValue={organization.secondaryColor || ""} />
                </label>

                <label className="field">
                  <span>E-mail de suporte</span>
                  <input name="supportEmail" type="email" defaultValue={organization.supportEmail || ""} />
                </label>

                <label className="field">
                  <span>Telefone / WhatsApp</span>
                  <input name="supportPhone" defaultValue={organization.supportPhone || ""} />
                </label>

                <div className="actionRow">
                  <button className="secondaryButton smallButton" type="submit">
                    Salvar dados
                  </button>
                </div>
              </form>

              <form action={updateOrganizationStatusAction} className="inlineForm">
                <input type="hidden" name="organizationId" value={organization.id} />
                <input type="hidden" name="isActive" value={String(!organization.isActive)} />
                <button className="secondaryButton smallButton" type="submit">
                  {organization.isActive ? "Desativar operação" : "Ativar operação"}
                </button>
              </form>

              <div className="actionRow">
                <Link className="button smallButton" href={`/admin/operations/${organization.id}`}>
                  Ver detalhe
                </Link>
                {organization.publicDomain ? (
                  <a
                    className="secondaryButton smallButton"
                    href={`https://${organization.publicDomain}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir público
                  </a>
                ) : null}
                {organization.adminDomain ? (
                  <a
                    className="secondaryButton smallButton"
                    href={`https://${organization.adminDomain}/admin`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir admin
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
