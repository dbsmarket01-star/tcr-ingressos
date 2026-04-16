import Link from "next/link";
import { requestPasswordResetAction } from "@/features/auth/auth.actions";

type ForgotPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const sent = params.sent === "1";

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <Link className="brand" href="/">
          <span className="brandMark">T</span>
          <span>TCR Ingressos</span>
        </Link>

        <div>
          <p className="publicBadge">Acesso interno</p>
          <h1>Recuperar senha</h1>
          <p className="muted">
            Informe o e-mail do seu usuario interno. Se ele existir e estiver ativo, enviaremos um link de redefinicao.
          </p>
        </div>

        {sent ? (
          <div className="successBox">
            Se o e-mail estiver cadastrado, o link de redefinicao foi enviado.
          </div>
        ) : null}

        <form action={requestPasswordResetAction} className="form">
          <label className="field">
            <span>E-mail</span>
            <input autoComplete="email" name="email" required type="email" />
          </label>

          <button className="button fullButton" type="submit">
            Enviar link de redefinicao
          </button>
        </form>

        <Link className="textLink" href="/login">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
