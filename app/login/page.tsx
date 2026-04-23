import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/features/auth/auth.actions";
import { getCurrentAdmin } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect("/admin");
  }

  const params = searchParams ? await searchParams : {};
  const hasError = params.error === "invalid";
  const wasReset = params.reset === "1";
  const organizationContext = await getCurrentOrganizationContext();
  const isPlatformHost = organizationContext.isPlatformHost;
  const loginBrandLabel = isPlatformHost ? organizationContext.platformName : organizationContext.brandName;
  const loginPlaceholderDomain = isPlatformHost
    ? organizationContext.platformHost || "ingresaas.app.br"
    : organizationContext.organization.adminDomain || organizationContext.organization.publicDomain || "sua-operacao.com.br";

  return (
    <main className="loginShell loginShellAdmin">
      <section className="loginPanel adminLoginPanel">
        <div className="loginFormArea">
          <Link className="brand loginBrand loginBrandDark" href="/">
            {organizationContext.brandLogoUrl ? (
              <img alt={loginBrandLabel} className="brandLogo" src={organizationContext.brandLogoUrl} />
            ) : (
              <span className="brandMark">{organizationContext.brandMark}</span>
            )}
            <span>{loginBrandLabel}</span>
          </Link>

          <div>
            <p className="publicBadge">Acesso interno</p>
            <h2>{isPlatformHost ? `Acesso à ${organizationContext.platformName}` : "Bem-vindo de volta"}</h2>
            <p className="muted">
              {isPlatformHost
                ? `Entre para administrar a plataforma, organizar operações filhas e acompanhar a evolução da ${organizationContext.platformName}.`
                : `Entre para acompanhar vendas, check-in, pedidos, leads e a operação da ${organizationContext.brandName} em um só lugar.`}
            </p>
          </div>

          {isPlatformHost ? (
            <div className="platformLoginSignals" aria-label="Escopos da plataforma">
              <span>Painel master</span>
              <span>Operações filhas</span>
              <span>Governança central</span>
            </div>
          ) : null}

          {hasError ? (
            <div className="errorBox">E-mail ou senha inválidos. Confira os dados e tente novamente.</div>
          ) : null}

          {wasReset ? (
            <div className="successBox">Senha redefinida com sucesso. Entre com a nova senha.</div>
          ) : null}

          <form action={loginAction} className="form">
            <label className="field">
              <span>E-mail</span>
              <input
                autoComplete="email"
                name="email"
                placeholder={`admin@${loginPlaceholderDomain}`}
                required
                type="email"
              />
            </label>

            <label className="field">
              <span>Senha</span>
              <input
                autoComplete="current-password"
                name="password"
                placeholder="Sua senha"
                required
                type="password"
              />
            </label>

            <button className="button fullButton" type="submit">
              Entrar no painel
            </button>
          </form>

          <div className="loginSupportBox">
            <Link className="secondaryButton fullButton" href="/login/forgot">
              Recuperar senha
            </Link>
            <p>
              {isPlatformHost
                ? "Use este acesso para administrar a Ingresaas, cadastrar operações filhas e acompanhar a expansão da plataforma."
                : "Novos acessos internos devem ser liberados pelo proprietário dentro do painel, em Usuários."}
            </p>
          </div>
        </div>

        <div className="loginIntro loginAdminShowcase">
          <div className="loginShowcaseHeader">
            <span className="loginShowcasePill">
              {isPlatformHost ? "Painel master da plataforma" : "Plataforma de gerenciamento de eventos"}
            </span>
          </div>

          <div className="loginIntroCopy">
            <h1>
              {isPlatformHost
                ? "O painel que sustenta várias bilheterias embaixo da mesma base."
                : "Seu painel de operação com leitura mais clara e ritmo de evento real."}
            </h1>
            <p>
              {isPlatformHost
                ? `A ${organizationContext.platformName} centraliza o motor da plataforma, enquanto cada operação filha mantém domínio, eventos e equipe próprios.`
                : "Centralize bilheteria, equipe, atendimento e acompanhamento comercial com uma experiência mais segura para quem opera e mais profissional para quem vende."}
            </p>
          </div>

          <div className="loginFeatureStack" aria-label="Recursos do painel">
            <article className="loginFeatureCard">
              <strong>{isPlatformHost ? "Operações separadas" : "Análises em tempo real"}</strong>
              <span>
                {isPlatformHost
                  ? "Cada bilheteria roda com seu próprio domínio, sua própria identidade e seus próprios eventos."
                  : "Acompanhe faturamento, pedidos e desempenho por evento."}
              </span>
            </article>
            <article className="loginFeatureCard">
              <strong>{isPlatformHost ? "Motor único" : "Check-in com QR Code"}</strong>
              <span>
                {isPlatformHost
                  ? "Pagamentos, ingressos, leads, QR Code e check-in continuam rodando na mesma base técnica."
                  : "Validação rápida para portaria e operação no dia do evento."}
              </span>
            </article>
            <article className="loginFeatureCard">
              <strong>{isPlatformHost ? "Governança da plataforma" : "Gestão de equipe"}</strong>
              <span>
                {isPlatformHost
                  ? "Acompanhe bilheterias filhas, domínios, branding e prontidão operacional a partir de um só painel master."
                  : "Libere acessos internos e, quando precisar, restrinja por evento."}
              </span>
            </article>
          </div>

          {isPlatformHost ? (
            <div className="platformLoginFootnote">
              <strong>Fluxo recomendado</strong>
              <span>Entre no painel master, abra Operações e gerencie a TCR como primeira bilheteria filha.</span>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
