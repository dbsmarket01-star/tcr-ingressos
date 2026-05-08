"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <Link className="brand" href="/">
          <span className="brandMark">T</span>
          <span>Bilheteria</span>
        </Link>
        <div>
          <p className="publicBadge">Instabilidade temporária</p>
          <h1>Algo não saiu como esperado</h1>
          <p className="muted">
            Tente novamente. Se o problema persistir, procure o suporte da operação com o horário da tentativa.
          </p>
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
