import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventSectionNav } from "@/components/admin/EventSectionNav";
import { requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import {
  buyerReportCell,
  buyerReportFields,
  defaultBuyerReportFields,
  listEventBuyerTickets,
  parseBuyerReportFilters
} from "@/features/reports/event-buyers-report.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSearchParams(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else if (value) params.set(key, value);
  }
  return params;
}

export default async function EventBuyersReportPage({ params, searchParams }: Props) {
  const admin = await requirePermission("REPORTS");
  const { eventId } = await params;
  await requireEventAccess(eventId);
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: admin.organizationId },
    select: {
      id: true,
      title: true,
      lots: { select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }
    }
  });
  if (!event) notFound();

  const query = asSearchParams(await searchParams);
  const filters = parseBuyerReportFilters(query);
  const requestedPage = Number(query.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const { total, tickets } = await listEventBuyerTickets(eventId, filters, page);
  const pages = Math.max(1, Math.ceil(total / 50));
  const exportParams = new URLSearchParams();
  if (filters.search) exportParams.set("search", filters.search);
  if (filters.lotId) exportParams.set("lotId", filters.lotId);
  exportParams.set("status", filters.status);
  filters.fields.forEach((field) => exportParams.append("fields", field));
  const exportHref = `/admin/events/${eventId}/reports/buyers/export?${exportParams.toString()}`;
  const pageHref = (number: number) => {
    const next = new URLSearchParams(exportParams);
    next.set("page", String(number));
    return `/admin/events/${eventId}/reports/buyers?${next.toString()}`;
  };

  return (
    <AdminShell title="Relatórios do evento" description="Consulte compradores e participantes por ingresso, com exportação personalizada." headerVariant="minimal" hideSidebarIntro>
      <section className="eventOverviewShell eventBuyersReport">
        <div className="eventOverviewBreadcrumbs">
          <Link href="/admin/events">Congressos e eventos</Link><span>›</span>
          <Link href={`/admin/events/${eventId}`}>{event.title}</Link><span>›</span>
          <strong>Relatórios</strong>
        </div>
        <EventSectionNav active="buyers-report" event={event} />

        <div className="eventBuyersReportHero">
          <div>
            <span className="sectionEyebrow">Relatórios / compradores</span>
            <h1>Lista de compradores e participantes</h1>
            <p>Uma linha por ingresso emitido. Comprador e participante aparecem em campos separados; participante não informado permanece em branco.</p>
          </div>
          <div className="eventBuyersReportHeroActions">
            <strong>{total.toLocaleString("pt-BR")}</strong><span>ingressos no filtro</span>
            <a className="button" href={exportHref} download>Baixar CSV</a>
          </div>
        </div>

        <form className="eventBuyersReportFilters" method="get">
          <div className="eventBuyersReportFilterGrid">
            <label>Buscar comprador, participante, CPF, telefone ou pedido
              <input type="search" name="search" defaultValue={filters.search ?? ""} placeholder="Nome, pedido, e-mail..." maxLength={100} />
            </label>
            <label>Ingresso / categoria
              <select name="lotId" defaultValue={filters.lotId ?? ""}>
                <option value="">Todos os ingressos</option>
                {event.lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}
              </select>
            </label>
            <label>Situação do ingresso
              <select name="status" defaultValue={filters.status}>
                <option value="valid">Válidos e utilizados</option>
                <option value="used">Somente utilizados</option>
                <option value="all">Todos de pedidos pagos</option>
              </select>
            </label>
          </div>
          <details className="eventBuyersReportColumns" open>
            <summary>Escolha as informações da tabela e do arquivo</summary>
            <div className="eventBuyersReportColumnGrid">
              {(Object.entries(buyerReportFields) as Array<[keyof typeof buyerReportFields, string]>).map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" name="fields" value={key} defaultChecked={query.has("fields") ? filters.fields.includes(key) : defaultBuyerReportFields.includes(key)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </details>
          <div className="eventBuyersReportFilterActions">
            <button className="button" type="submit">Aplicar filtros</button>
            <Link className="button secondary" href={`/admin/events/${eventId}/reports/buyers`}>Limpar</Link>
            <small>Exportação restrita a usuários autorizados. O CSV inclui todos os ingressos do filtro, não apenas esta página.</small>
          </div>
        </form>

        <section className="eventBuyersReportResults" aria-label="Resultado do relatório">
          <div className="eventBuyersReportResultsHeader">
            <div><span className="sectionEyebrow">Prévia</span><h2>Ingressos encontrados</h2></div>
            <span>Página {Math.min(page, pages)} de {pages}</span>
          </div>
          {tickets.length ? (
            <div className="adminTableWrap eventBuyersReportTableWrap">
              <table className="table operationalTable eventBuyersReportTable">
                <thead><tr>{filters.fields.map((field) => <th key={field}>{buyerReportFields[field]}</th>)}</tr></thead>
                <tbody>{tickets.map((ticket) => (
                  <tr key={ticket.id}>{filters.fields.map((field) => <td key={field}>{buyerReportCell(ticket, field) || "—"}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="eventBuyersReportEmpty">Nenhum ingresso encontrado com esses filtros.</div>}
          {pages > 1 ? (
            <div className="eventBuyersReportPagination">
              {page > 1 ? <Link className="button secondary" href={pageHref(page - 1)}>← Anterior</Link> : <span />}
              <span>{Math.min(page, pages)} / {pages}</span>
              {page < pages ? <Link className="button secondary" href={pageHref(page + 1)}>Próxima →</Link> : <span />}
            </div>
          ) : null}
        </section>
      </section>
    </AdminShell>
  );
}
