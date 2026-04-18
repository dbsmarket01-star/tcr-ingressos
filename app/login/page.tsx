import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/features/auth/auth.actions";
import { getCurrentAdmin } from "@/features/auth/auth.service";

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

  return (
    <main className="loginShell loginShellAdmin">
      <section className="loginPanel adminLoginPanel">
        <div className="loginIntro">
          <Link className="brand loginBrand" href="/">
            <span className="brandMark">T</span>
            <span>TCR Ingressos</span>
          </Link>

          <div className="loginIntroCopy">
            <p className="publicBadge">Painel administrativo</p>
            <h1>Hoje e um bom dia para vender melhor.</h1>
            <p>
              Organize eventos, acompanhe pedidos e mantenha a operacao pronta para receber o
              publico com seguranca.
            </p>
          </div>

          <div className="loginMetrics">
            <span>Eventos</span>
            <strong>Operacao TCR</strong>
          </div>
        </div>

        <div className="loginFormArea">
          <div>
            <p className="publicBadge">Acesso interno</p>
            <h2>Entrar no painel</h2>
            <p className="muted">Use seu e-mail e senha para acessar a administracao da bilheteria.</p>
          </div>

          {hasError ? (
            <div className="errorBox">E-mail ou senha invalidos. Confira os dados e tente novamente.</div>
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
                placeholder="admin@tcringressos.com.br"
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
              Novos acessos internos devem ser liberados pelo proprietario dentro do painel, em
              Usuarios.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
