import { AdminShell } from "@/components/admin/AdminShell";
import { changePasswordAction } from "@/features/auth/auth.actions";
import { requirePermission } from "@/features/auth/auth.service";

type AdminAccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminAccountPage({ searchParams }: AdminAccountPageProps) {
  const admin = await requirePermission("ACCOUNT");
  const params = searchParams ? await searchParams : {};
  const hasError = params.error === "invalid";
  const changed = params.changed === "1";

  return (
    <AdminShell
      title="Minha conta"
      description="Gerencie seus dados de acesso interno ao painel da TCR Ingressos."
    >
      <section className="grid twoColumns">
        <form action={changePasswordAction} className="card form">
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

        <section className="card">
          <h2>Dados do usuario</h2>
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
            Para alterar nome, email ou papel de acesso, use a tela de usuarios com um perfil proprietario.
          </p>
        </section>
      </section>
    </AdminShell>
  );
}
