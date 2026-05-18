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
