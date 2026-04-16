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
    <main className="loginShell">
      <section className="loginPanel">
        <Link className="brand" href="/">
          <span className="brandMark">T</span>
          <span>TCR Ingressos</span>
        </Link>

        <div>
          <p className="publicBadge">Acesso interno</p>
          <h1>Entrar no painel</h1>
          <p className="muted">
            Use o e-mail e a senha do administrador para acessar a operacao da bilheteria.
          </p>
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

        <Link className="textLink" href="/login/forgot">
          Esqueci minha senha
        </Link>
      </section>
    </main>
  );
}
