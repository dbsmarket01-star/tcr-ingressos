import Link from "next/link";
import { requestPasswordResetAction } from "@/features/auth/auth.actions";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";

type ForgotPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const sent = params.sent === "1";
  const organizationContext = await getCurrentOrganizationContext();
  const isPlatformHost = organizationContext.isPlatformHost;
  const placeholderDomain = isPlatformHost
    ? organizationContext.platformHost || "ingresaas.app.br"
    : organizationContext.organization.adminDomain || organizationContext.organization.publicDomain || "sua-operacao.com.br";

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
            {!organizationContext.brandLogoUrl ? <span>{organizationContext.brandName}</span> : null}
          </Link>

          <div>
            <p className="publicBadge">Acesso interno</p>
            <h2>Recuperar senha</h2>
            <p className="muted">
              {isPlatformHost
                ? "Informe o e-mail do acesso master da plataforma. Se ele existir e estiver ativo, enviaremos um link de redefinição."
                : "Informe o e-mail do seu usuário interno. Se ele existir e estiver ativo, enviaremos um link de redefinição."}
            </p>
          </div>

          {sent ? (
            <div className="successBox">
              Se o e-mail estiver cadastrado, o link de redefinição foi enviado.
            </div>
          ) : null}

          <form action={requestPasswordResetAction} className="form">
            <label className="field">
              <span>E-mail</span>
              <input
                autoComplete="email"
                name="email"
                placeholder={`admin@${placeholderDomain}`}
                required
                type="email"
              />
            </label>

            <button className="button fullButton" type="submit">
              Enviar link de redefinição
            </button>
          </form>

          <div className="loginSupportBox">
            <Link className="secondaryButton fullButton" href="/login">
              Voltar para o login
            </Link>
            <p>
              {isPlatformHost
                ? "Novos acessos master devem ser mantidos sob controle da plataforma. As equipes das bilheterias filhas continuam sendo geridas em cada operação."
                : "Novos acessos internos devem ser liberados pelo proprietário dentro do painel, em Usuários."}
            </p>
          </div>
        </div>

        <div className="loginIntro loginAdminShowcase loginAdminShowcaseSecondary">
          <div className="loginShowcaseHeader">
            <span className="loginShowcasePill">Recuperação segura de acesso</span>
          </div>

          <div className="loginIntroCopy">
            <h1>{isPlatformHost ? "Redefina o acesso master sem perder a visão da plataforma." : "Redefina o acesso sem perder o controle da operação."}</h1>
            <p>
              {isPlatformHost
                ? "A plataforma continua protegida e você retoma a gestão das bilheterias filhas, domínios e acessos internos sem reconfigurar a base."
                : "A equipe continua protegida e o proprietário mantém o gerenciamento dos acessos internos por perfil e por evento."}
            </p>
          </div>

          <div className="loginFeatureStack" aria-label="Orientações de acesso interno">
            <article className="loginFeatureCard">
              <strong>Link direto no e-mail</strong>
              <span>Se o usuário estiver ativo, o sistema envia a redefinição de forma automática.</span>
            </article>
            <article className="loginFeatureCard">
              <strong>Permissões preservadas</strong>
              <span>
                {isPlatformHost
                  ? "O acesso master volta com o mesmo papel de plataforma. Os acessos das operações filhas continuam separados."
                  : "O usuário volta com o mesmo perfil e com o mesmo escopo de eventos liberados."}
              </span>
            </article>
            <article className="loginFeatureCard">
              <strong>{isPlatformHost ? "Fluxo controlado pela plataforma" : "Fluxo controlado pelo proprietário"}</strong>
              <span>
                {isPlatformHost
                  ? "A Ingresaas mantém o acesso master no painel central. Cada operação filha continua cuidando da própria equipe."
                  : "Novos acessos continuam sendo liberados só dentro do painel administrativo."}
              </span>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
