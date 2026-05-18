"use client";

import Link from "next/link";
import { getFriendlyError } from "@/lib/friendly-error";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);
  const friendlyError = getFriendlyError(error, "Atualize a página ou tente novamente em alguns instantes.");

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <Link className="brand" href="/">
          <span className="brandMark">I</span>
          <span>Ingresaas</span>
        </Link>
        <div>
          <p className="publicBadge">Instabilidade temporária</p>
          <h1>{friendlyError.title}</h1>
          <p className="muted">{friendlyError.message}</p>
          {error.digest ? <small className="muted">Código para suporte: {error.digest}</small> : null}
        </div>
        <div className="formActions">
          <button className="button" type="button" onClick={reset}>
            Tentar novamente
          </button>
          <Link className="secondaryButton" href="/">
            Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  );
}
