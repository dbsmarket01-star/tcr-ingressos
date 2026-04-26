import { AdminShell } from "@/components/admin/AdminShell";
import { changePasswordAction } from "@/features/auth/auth.actions";
import { requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";

type AdminAccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminAccountPage({ searchParams }: AdminAccountPageProps) {
  const admin = await requirePermission("ACCOUNT");
  const organizationContext = await getCurrentOrganizationContext();
  const isPlatformHost = organizationContext.isPlatformHost;
  const params = searchParams ? await searchParams : {};
  const hasError = params.error === "invalid";
  const changed = params.changed === "1";

  return (
    <AdminShell
      title="Minha conta"
      description={`Gerencie seus dados de acesso interno ao painel da ${organizationContext.brandName}.`}
    >
      <section className="platformOperationsHero spacedSection" aria-label="Conta e segurança">
        <div>
          <span className="eyebrow">Acesso interno</span>
          <h2>{isPlatformHost ? "Controle seu acesso ao painel master com uma leitura mais clara." : "Gerencie seu acesso interno com mais segurança."}</h2>
          <p>
            {isPlatformHost
              ? "Atualize sua senha, revise seu perfil e mantenha a entrada no painel master protegida. Esta área é para a sua conta pessoal, não para configurar clientes."
              : `Atualize sua senha e revise os dados da sua conta para manter o acesso interno à ${organizationContext.brandName} mais seguro.`}
          </p>
        </div>
        <div className="platformOperationsHeroBadges">
          <span>Conta pessoal</span>
          <span>Segurança</span>
          <span>Acesso interno</span>
        </div>
      </section>

      <section className="grid twoColumns spacedSection">
        <form action={changePasswordAction} className="card form platformOperationsFilterCard">
          <h2>Trocar senha</h2>
          {hasError ? (
            <div className="errorBox">Confira a senha atual e confirme a nova senha corretamente.</div>
          ) : null}
          {changed ? <div className="successBox">Senha alterada com sucesso.</div> : null}

          <label className="field">
            <span>Senha atual</span>
            <input autoComplete="current-password" name="currentPassword" required type="password" minLength={8} />
          </label>
          <label className="field">
            <span>Nova senha</span>
            <input autoComplete="new-password" name="newPassword" required type="password" minLength={8} />
          </label>
          <label className="field">
            <span>Confirmar nova senha</span>
            <input autoComplete="new-password" name="confirmPassword" required type="password" minLength={8} />
          </label>

          <button className="button" type="submit">
            Salvar nova senha
          </button>
        </form>

        <section className="card platformOperationsGuideCard">
          <h2>Dados do usuário</h2>
          <dl className="detailList">
            <div>
              <dt>Nome</dt>
              <dd>{admin.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{admin.email}</dd>
            </div>
            <div>
              <dt>Papel</dt>
              <dd>{admin.role}</dd>
            </div>
          </dl>
          <p className="muted">
            Para alterar nome, e-mail ou papel de acesso, use a tela de usuários com um perfil proprietário.
          </p>
        </section>
      </section>
    </AdminShell>
  );
}
