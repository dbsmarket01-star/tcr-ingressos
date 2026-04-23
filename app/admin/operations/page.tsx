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

  return (
    <AdminShell
      title="Operações"
      description="Cadastre e organize as bilheterias filhas da Ingressas, com domínio, equipe e operação separados."
    >
      <section className="grid twoColumns">
        <form action={createOrganizationAction} className="card form">
          <div>
            <span className="eyebrow">Nova operação</span>
            <h2>Criar uma nova bilheteria filha</h2>
            <p className="muted">
              Use esta etapa para preparar a próxima operação antes de apontar o domínio real dela.
            </p>
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

        <section className="card">
          <span className="eyebrow">Leitura da arquitetura</span>
          <h2>Como a Ingressas vai crescer</h2>
          <div className="permissionList">
            <p>
              <strong>Ingressas:</strong> a plataforma-mãe que administra o motor SaaS.
            </p>
            <p>
              <strong>Operação filha:</strong> uma bilheteria com marca, domínio, equipe e eventos próprios.
            </p>
            <p>
              <strong>TCR:</strong> segue como a primeira operação já ativa na base.
            </p>
            <p>
              <strong>Próximo passo:</strong> cadastrar A2 e os próximos clientes, depois apontar domínio e branding.
            </p>
          </div>
        </section>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Operações cadastradas</h2>
            <p>Edite dados básicos, confira domínios e mantenha o status das operações sob controle.</p>
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
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
