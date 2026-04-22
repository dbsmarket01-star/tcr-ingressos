import Link from "next/link";
import { resetPasswordAction } from "@/features/auth/auth.actions";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";

type ResetPasswordPageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ params, searchParams }: ResetPasswordPageProps) {
  const { token } = await params;
  const query = searchParams ? await searchParams : {};
  const hasError = query.error === "invalid";
  const organizationContext = await getCurrentOrganizationContext();

  return (
    <main className="loginShell loginShellAdmin">
      <section className="loginPanel adminLoginPanel">
        <div className="loginFormArea">
          <Link className="brand loginBrand loginBrandDark" href="/">
            <span className="brandMark">{organizationContext.brandMark}</span>
            <span>{organizationContext.brandName}</span>
          </Link>

          <div>
            <p className="publicBadge">Acesso interno</p>
            <h2>Nova senha</h2>
            <p className="muted">Crie uma nova senha para voltar ao painel administrativo da {organizationContext.brandName} com segurança.</p>
          </div>

          {hasError ? (
            <div className="errorBox">
              Link expirado ou inválido, ou as senhas não coincidem. Solicite uma nova redefinição.
            </div>
          ) : null}

          <form action={resetPasswordAction} className="form">
            <input type="hidden" name="token" value={token} />
            <label className="field">
              <span>Nova senha</span>
              <input autoComplete="new-password" name="newPassword" required type="password" minLength={8} />
            </label>
            <label className="field">
              <span>Confirmar nova senha</span>
              <input autoComplete="new-password" name="confirmPassword" required type="password" minLength={8} />
            </label>

            <button className="button fullButton" type="submit">
              Redefinir senha
            </button>
          </form>

          <div className="loginSupportBox">
            <Link className="secondaryButton fullButton" href="/login">
              Voltar para o login
            </Link>
            <p>Depois da redefinição, o acesso volta com o mesmo perfil e com as mesmas permissões já liberadas.</p>
          </div>
        </div>

        <div className="loginIntro loginAdminShowcase">
          <div className="loginShowcaseHeader">
            <span className="loginShowcasePill">Acesso restaurado com segurança</span>
          </div>

          <div className="loginIntroCopy">
            <h1>Volte para a operação sem perder o contexto do seu trabalho.</h1>
            <p>
              Senha nova, acesso preservado e a mesma rotina de eventos, pedidos, check-in e
              atendimento pronta para continuar.
            </p>
          </div>

          <div className="loginFeatureStack" aria-label="Benefícios da redefinição">
            <article className="loginFeatureCard">
              <strong>Fluxo simples</strong>
              <span>Defina a nova senha em poucos segundos e retome o painel sem ruído.</span>
            </article>
            <article className="loginFeatureCard">
              <strong>Permissões mantidas</strong>
              <span>O usuário continua com o mesmo perfil e com o mesmo escopo de eventos já liberado.</span>
            </article>
            <article className="loginFeatureCard">
              <strong>Controle centralizado</strong>
              <span>O proprietário mantém a gestão dos acessos internos dentro da própria plataforma.</span>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
