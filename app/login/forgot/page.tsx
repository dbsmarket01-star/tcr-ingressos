import Link from "next/link";
import { requestPasswordResetAction } from "@/features/auth/auth.actions";

type ForgotPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const sent = params.sent === "1";

  return (
    <main className="loginShell loginShellAdmin">
      <section className="loginPanel adminLoginPanel">
        <div className="loginFormArea">
          <Link className="brand loginBrand loginBrandDark" href="/">
            <span className="brandMark">T</span>
            <span>TCR Ingressos</span>
          </Link>

          <div>
            <p className="publicBadge">Acesso interno</p>
            <h2>Recuperar senha</h2>
            <p className="muted">
              Informe o e-mail do seu usuário interno. Se ele existir e estiver ativo, enviaremos um
              link de redefinição.
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
              <input autoComplete="email" name="email" placeholder="admin@tcringressos.app.br" required type="email" />
            </label>

            <button className="button fullButton" type="submit">
              Enviar link de redefinição
            </button>
          </form>

          <div className="loginSupportBox">
            <Link className="secondaryButton fullButton" href="/login">
              Voltar para o login
            </Link>
            <p>Novos acessos internos devem ser liberados pelo proprietário dentro do painel, em Usuários.</p>
          </div>
        </div>

        <div className="loginIntro loginAdminShowcase loginAdminShowcaseSecondary">
          <div className="loginShowcaseHeader">
            <span className="loginShowcasePill">Recuperação segura de acesso</span>
          </div>

          <div className="loginIntroCopy">
            <h1>Redefina o acesso sem perder o controle da operação.</h1>
            <p>
              A equipe continua protegida e o proprietário mantém o gerenciamento dos acessos internos
              por perfil e por evento.
            </p>
          </div>

          <div className="loginFeatureStack" aria-label="Orientações de acesso interno">
            <article className="loginFeatureCard">
              <strong>Link direto no e-mail</strong>
              <span>Se o usuário estiver ativo, o sistema envia a redefinição de forma automática.</span>
            </article>
            <article className="loginFeatureCard">
              <strong>Permissões preservadas</strong>
              <span>O usuário volta com o mesmo perfil e com o mesmo escopo de eventos liberados.</span>
            </article>
            <article className="loginFeatureCard">
              <strong>Fluxo controlado pelo proprietário</strong>
              <span>Novos acessos continuam sendo liberados só dentro do painel administrativo.</span>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
