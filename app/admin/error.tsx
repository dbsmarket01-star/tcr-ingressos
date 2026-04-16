"use client";

import Link from "next/link";

export default function AdminErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <main className="adminFallback">
      <section className="card">
        <p className="publicBadge">Painel administrativo</p>
        <h1>Falha ao carregar esta area</h1>
        <p className="muted">
          A operacao nao foi concluida. Tente novamente antes de repetir qualquer acao sensivel.
        </p>
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
