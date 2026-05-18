import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="notFoundShell">
      <section className="notFoundCard">
        <span className="notFoundBadge">Página não encontrada</span>
        <h1>Não encontramos o que você procura.</h1>
        <p>
          O link pode ter sido alterado, o evento pode não estar publicado ou essa página pode não existir nesta
          bilheteria.
        </p>
        <div className="notFoundHelp">
          <span>Confira se o endereço está correto.</span>
          <span>Se estava procurando um evento, volte para a lista de eventos disponíveis.</span>
          <span>Se queria acessar ingressos comprados, use o e-mail da compra em Meus ingressos.</span>
        </div>
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
