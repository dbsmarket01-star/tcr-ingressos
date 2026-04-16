import Link from "next/link";
import { resetPasswordAction } from "@/features/auth/auth.actions";

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

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <Link className="brand" href="/">
          <span className="brandMark">T</span>
          <span>TCR Ingressos</span>
        </Link>

        <div>
          <p className="publicBadge">Acesso interno</p>
          <h1>Nova senha</h1>
          <p className="muted">Crie uma nova senha para acessar o painel administrativo.</p>
        </div>

        {hasError ? (
          <div className="errorBox">
            Link expirado/invalido ou senhas diferentes. Solicite uma nova redefinicao.
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

        <Link className="textLink" href="/login">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
