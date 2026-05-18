import Link from "next/link";

export default function AdminNotFoundPage() {
  return (
    <main className="adminFallback">
      <section className="notFoundCard adminNotFoundCard">
        <span className="notFoundBadge">Área não encontrada</span>
        <h1>Não encontramos essa tela no painel.</h1>
        <p>
          A função pode não existir para esta operação, o link pode estar incorreto ou o registro pode ter sido removido.
        </p>
        <div className="notFoundHelp">
          <span>Volte pelo menu lateral se estava acessando uma área do painel.</span>
          <span>Confira se o evento, pedido ou ingresso ainda existe nesta bilheteria.</span>
          <span>Se a função deveria aparecer, verifique as permissões do usuário logado.</span>
        </div>
        <div className="notFoundActions">
          <Link className="button" href="/admin">
            Voltar ao dashboard
          </Link>
          <Link className="secondaryButton" href="/admin/events">
            Ver eventos
          </Link>
        </div>
      </section>
    </main>
  );
}
