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
            <h2>Bem-vindo de volta</h2>
            <p className="muted">
              Entre para acompanhar vendas, check-in, pedidos, leads e a operação da {organizationContext.brandName}
              em um só lugar.
            </p>
          </div>

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
                placeholder={`admin@${organizationContext.organization.adminDomain || organizationContext.organization.publicDomain || "sua-operacao.com.br"}`}
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
              Novos acessos internos devem ser liberados pelo proprietário dentro do painel, em Usuários.
            </p>
          </div>
        </div>

        <div className="loginIntro loginAdminShowcase">
          <div className="loginShowcaseHeader">
            <span className="loginShowcasePill">Plataforma de gerenciamento de eventos</span>
          </div>

          <div className="loginIntroCopy">
            <h1>Seu painel de operação com leitura mais clara e ritmo de evento real.</h1>
            <p>
              Centralize bilheteria, equipe, atendimento e acompanhamento comercial com uma
              experiência mais segura para quem opera e mais profissional para quem vende.
            </p>
          </div>

          <div className="loginFeatureStack" aria-label="Recursos do painel">
            <article className="loginFeatureCard">
              <strong>Análises em tempo real</strong>
              <span>Acompanhe faturamento, pedidos e desempenho por evento.</span>
            </article>
            <article className="loginFeatureCard">
              <strong>Check-in com QR Code</strong>
              <span>Validação rápida para portaria e operação no dia do evento.</span>
            </article>
            <article className="loginFeatureCard">
              <strong>Gestão de equipe</strong>
              <span>Libere acessos internos e, quando precisar, restrinja por evento.</span>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
