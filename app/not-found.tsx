import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="notFoundShell">
      <section className="notFoundCard">
        <span className="notFoundBadge">Página não encontrada</span>
        <h1>Não encontramos o que você procura.</h1>
        <p>
          O link pode ter sido alterado, o evento pode não estar publicado ou essa página não existe mais nesta
          bilheteria.
        </p>
        <div className="notFoundActions">
          <Link className="button" href="/">
            Ver eventos
          </Link>
          <Link className="secondaryButton" href="/meus-ingressos">
            Meus ingressos
          </Link>
        </div>
      </section>
    </main>
  );
}
