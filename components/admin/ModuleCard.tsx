type ModuleCardProps = {
  title: string;
  children: React.ReactNode;
  status?: "Pronto" | "Preparado" | "Proxima fase";
};

export function ModuleCard({ title, children, status = "Preparado" }: ModuleCardProps) {
  return (
    <article className="card moduleCard">
      <div className="moduleHeader">
        <h2>{title}</h2>
        <span className="status published">{status}</span>
      </div>
      <div className="muted moduleBody">{children}</div>
    </article>
  );
}
