"use client";

import Link from "next/link";
import { getFriendlyError } from "@/lib/friendly-error";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);
  const friendlyError = getFriendlyError(error, "A página encontrou um problema inesperado. Tente novamente em instantes.");

  return (
    <html lang="pt-BR">
      <body>
        <main className="notFoundShell">
          <section className="notFoundCard">
            <span className="notFoundBadge">Algo precisa de atenção</span>
            <h1>{friendlyError.title}</h1>
            <p>{friendlyError.message}</p>
            {error.digest ? <small className="muted">Código para suporte: {error.digest}</small> : null}
            <div className="notFoundActions">
              <button className="button" type="button" onClick={reset}>
                Tentar novamente
              </button>
              <Link className="secondaryButton" href="/">
                Voltar ao início
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
