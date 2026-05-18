"use client";

import Link from "next/link";
import { getFriendlyError } from "@/lib/friendly-error";

export default function AdminErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);
  const friendlyError = getFriendlyError(error, "Tente novamente antes de repetir qualquer ação sensível.");

  return (
    <main className="adminFallback">
      <section className="card">
        <p className="publicBadge">Painel administrativo</p>
        <h1>{friendlyError.title}</h1>
        <p className="muted">{friendlyError.message}</p>
        {error.digest ? <small className="muted">Código para suporte: {error.digest}</small> : null}
        <div className="formActions">
          <button className="button" type="button" onClick={reset}>
            Tentar novamente
          </button>
          <Link className="secondaryButton" href="/admin">
            Voltar ao dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
