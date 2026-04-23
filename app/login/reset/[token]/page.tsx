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
  const isPlatformHost = organizationContext.isPlatformHost;

  return (
    <main className="loginShell loginShellAdmin">
      <section className="loginPanel adminLoginPanel">
        <div className="loginFormArea">
          <Link className="brand loginBrand loginBrandDark" href="/">
            {organizationContext.brandLogoUrl ? (
              <img alt={organizationContext.brandName} className="brandLogo" src={organizationContext.brandLogoUrl} />
            ) : (
              <span className="brandMark">{organizationContext.brandMark}</span>
            )}
            <span>{organizationContext.brandName}</span>
          </Link>

          <div>
            <p className="publicBadge">Acesso interno</p>
            <h2>Nova senha</h2>
            <p className="muted">
              {isPlatformHost
                ? `Crie uma nova senha para voltar ao painel master da ${organizationContext.platformName} com segurança.`
                : `Crie uma nova senha para voltar ao painel administrativo da ${organizationContext.brandName} com segurança.`}
            </p>
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
            <p>
              {isPlatformHost
                ? "Depois da redefinição, o acesso volta com o mesmo papel de plataforma e a mesma visão sobre as operações filhas."
                : "Depois da redefinição, o acesso volta com o mesmo perfil e com as mesmas permissões já liberadas."}
            </p>
          </div>
        </div>

        <div className="loginIntro loginAdminShowcase">
          <div className="loginShowcaseHeader">
            <span className="loginShowcasePill">Acesso restaurado com segurança</span>
          </div>

          <div className="loginIntroCopy">
            <h1>
              {isPlatformHost
                ? "Volte para o painel master sem perder o contexto da plataforma."
                : "Volte para a operação sem perder o contexto do seu trabalho."}
            </h1>
            <p>
              {isPlatformHost
                ? "Senha nova, acesso preservado e a mesma visão sobre operações, domínios, usuários e evolução da base pronta para continuar."
                : "Senha nova, acesso preservado e a mesma rotina de eventos, pedidos, check-in e atendimento pronta para continuar."}
            </p>
          </div>

          <div className="loginFeatureStack" aria-label="Benefícios da redefinição">
            <article className="loginFeatureCard">
              <strong>Fluxo simples</strong>
              <span>Defina a nova senha em poucos segundos e retome o painel sem ruído.</span>
            </article>
            <article className="loginFeatureCard">
              <strong>Permissões mantidas</strong>
              <span>
                {isPlatformHost
                  ? "O acesso master continua com o mesmo papel na plataforma, sem misturar permissões das bilheterias filhas."
                  : "O usuário continua com o mesmo perfil e com o mesmo escopo de eventos já liberado."}
              </span>
            </article>
            <article className="loginFeatureCard">
              <strong>{isPlatformHost ? "Governança centralizada" : "Controle centralizado"}</strong>
              <span>
                {isPlatformHost
                  ? "A Ingresaas mantém o controle do acesso master, enquanto cada operação filha cuida da própria equipe."
                  : "O proprietário mantém a gestão dos acessos internos dentro da própria plataforma."}
              </span>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
