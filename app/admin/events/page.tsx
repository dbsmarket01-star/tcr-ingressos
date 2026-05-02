import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { duplicateEventAction } from "@/features/events/event.actions";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatCurrency } from "@/lib/format";
import { getEventCapacity, getEventRevenueInCents, listEvents } from "@/features/events/event.service";
import { getPublicEventUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

type EventsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    date?: string;
    city?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const statusLabels = {
  DRAFT: "Em preparação",
  PUBLISHED: "Publicado",
  UNPUBLISHED: "Pausado",
  FINISHED: "Encerrado",
  CANCELED: "Cancelado"
} as const;

function formatEventDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function formatEventTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function getDatePresetMatch(startsAt: Date, preset: string) {
  if (!preset || preset === "all") {
    return true;
  }

  const now = new Date();
  const eventDate = new Date(startsAt);

  if (preset === "upcoming") {
    return eventDate >= now;
  }

  if (preset === "past") {
    return eventDate < now;
  }

  if (preset === "this-month") {
    return eventDate.getMonth() === now.getMonth() && eventDate.getFullYear() === now.getFullYear();
  }

  if (preset === "next-60") {
    const sixtyDaysAhead = new Date(now);
    sixtyDaysAhead.setDate(now.getDate() + 60);
    return eventDate >= now && eventDate <= sixtyDaysAhead;
  }

  return true;
}

function getProgressPercent(sold: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((sold / total) * 100)));
}

function getStatusClass(status: keyof typeof statusLabels) {
  if (status === "PUBLISHED") return "published";
  if (status === "DRAFT" || status === "UNPUBLISHED") return "pending";
  if (status === "FINISHED") return "draft";
  return "canceled";
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const admin = await requirePermission("EVENTS");
  const organizationContext = await getCurrentOrganizationContext();
  const params = searchParams ? await searchParams : {};
  const query = params.q?.trim() ?? "";
  const selectedStatus = params.status?.trim() || "all";
  const selectedDate = params.date?.trim() || "all";
  const selectedCity = params.city?.trim() || "all";
  const page = Math.max(1, Number(params.page || "1") || 1);
  const pageSize = Math.min(20, Math.max(5, Number(params.pageSize || "5") || 5));

  const events = await listEvents(admin.organizationId!, getAdminAllowedEventIds(admin));
  const cityOptions = Array.from(new Set(events.map((event) => `${event.city}, ${event.state}`))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  const filteredEvents = events.filter((event) => {
    const matchesQuery =
      !query ||
      [event.title, event.slug, event.city, event.state, event.venueName]
        .filter(Boolean)
        .some((value) => normalizeText(String(value)).includes(normalizeText(query)));

    const matchesStatus = selectedStatus === "all" ? true : event.status === selectedStatus;
    const matchesDate = getDatePresetMatch(event.startsAt, selectedDate);
    const matchesCity = selectedCity === "all" ? true : `${event.city}, ${event.state}` === selectedCity;

    return matchesQuery && matchesStatus && matchesDate && matchesCity;
  });

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pagedEvents = filteredEvents.slice(startIndex, startIndex + pageSize);
  const hasFilters = Boolean(query || selectedStatus !== "all" || selectedDate !== "all" || selectedCity !== "all");
  const pagesToShow = Array.from(new Set([1, safePage - 1, safePage, safePage + 1, totalPages]))
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  return (
    <AdminShell
      title="Congressos e eventos"
      description="Visualize e gerencie todos os seus eventos em um só lugar."
    >
      <section className="eventsIndexShell">
        <section className="eventsIndexHeaderCard">
          <div>
            <h2>Lista de congressos e eventos</h2>
            <p>Visualize e gerencie todos os seus eventos em um só lugar.</p>
          </div>
          <Link className="button eventsIndexPrimaryAction" href="/admin/events/new">
            Novo evento
          </Link>
        </section>

        <section className="eventsIndexPanel">
          <form className="eventsIndexFiltersBar">
            <label className="eventsIndexSearchField">
              <span className="srOnly">Buscar eventos</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input defaultValue={query} name="q" placeholder="Buscar eventos..." />
              <button aria-label="Aplicar filtros" className="eventsIndexSearchSubmit" type="submit">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </button>
            </label>

            <label className="eventsIndexFilterField">
              <span>Status</span>
              <select defaultValue={selectedStatus} name="status">
                <option value="all">Todos</option>
                <option value="PUBLISHED">Publicado</option>
                <option value="DRAFT">Em preparação</option>
                <option value="UNPUBLISHED">Pausado</option>
                <option value="FINISHED">Encerrado</option>
                <option value="CANCELED">Cancelado</option>
              </select>
            </label>

            <label className="eventsIndexFilterField">
              <span>Data</span>
              <select defaultValue={selectedDate} name="date">
                <option value="all">Todas as datas</option>
                <option value="upcoming">Próximos eventos</option>
                <option value="this-month">Este mês</option>
                <option value="next-60">Próximos 60 dias</option>
                <option value="past">Eventos passados</option>
              </select>
            </label>

            <label className="eventsIndexFilterField">
              <span>Local</span>
              <select defaultValue={selectedCity} name="city">
                <option value="all">Todos os locais</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>

            <input type="hidden" name="pageSize" value={String(pageSize)} />

            <div className="eventsIndexFilterActions">
              <Link className="secondaryButton" href="/admin/events">
                Limpar filtros
              </Link>
            </div>
          </form>

          <div className="eventsIndexTableWrap">
            <div className="eventsIndexTableHead">
              <span>Evento</span>
              <span>Data</span>
              <span>Local</span>
              <span>Vendas</span>
              <span>Faturamento</span>
              <span>Status</span>
              <span>Ações</span>
            </div>

            <div className="eventsIndexRows">
              {pagedEvents.length === 0 ? (
                <div className="empty">
                  {hasFilters
                    ? "Nenhum evento encontrado com os filtros selecionados."
                    : `Nenhum evento cadastrado ainda para ${organizationContext.brandName}.`}
                </div>
              ) : (
                pagedEvents.map((event) => {
                  const capacity = getEventCapacity(event);
                  const revenueInCents = getEventRevenueInCents(event);
                  const progress = getProgressPercent(capacity.sold, capacity.total);

                  return (
                    <article className="eventsIndexRowCard" key={event.id}>
                      <div className="eventsIndexEventCell">
                        <div className="eventsIndexThumb">
                          {event.bannerUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt={event.title} src={event.bannerUrl} />
                          ) : (
                            <strong>{event.title.slice(0, 2).toUpperCase()}</strong>
                          )}
                        </div>
                        <div className="eventsIndexEventCopy">
                          <strong>{event.title}</strong>
                          <span>/{event.slug}</span>
                        </div>
                      </div>

                      <div className="eventsIndexDateCell">
                        <span className="eventsIndexMetaLine">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="5" width="18" height="16" rx="3" />
                            <path d="M16 3v4M8 3v4M3 10h18" />
                          </svg>
                          <strong>{formatEventDate(event.startsAt)}</strong>
                        </span>
                        <span className="eventsIndexMetaLine muted">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="8" />
                            <path d="M12 8v5l3 2" />
                          </svg>
                          <span>{formatEventTime(event.startsAt)}</span>
                        </span>
                      </div>

                      <div className="eventsIndexLocationCell">
                        <span className="eventsIndexMetaLine">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 21s-6-5.34-6-11a6 6 0 1 1 12 0c0 5.66-6 11-6 11Z" />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                          <strong>
                            {event.city}, {event.state}
                          </strong>
                        </span>
                        <span>{event.venueName}</span>
                      </div>

                      <div className="eventsIndexSalesCell">
                        <strong>
                          {capacity.sold} / {capacity.total}
                        </strong>
                        <div className="eventsIndexProgressLine" aria-label={`${progress}% vendido`}>
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <small>{progress}%</small>
                      </div>

                      <div className="eventsIndexRevenueCell">
                        <strong>{formatCurrency(revenueInCents)}</strong>
                      </div>

                      <div className="eventsIndexStatusCell">
                        <span className={`status ${getStatusClass(event.status)}`}>{statusLabels[event.status]}</span>
                      </div>

                      <div className="eventsIndexActionsCell">
                        <Link className="secondaryButton smallButton" href={getPublicEventUrl(event.slug)} target="_blank">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Visualizar
                        </Link>
                        <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 0 1 0 1.7l-1.2 1.2a1.2 1.2 0 0 1-1.7 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9v.2a1.2 1.2 0 0 1-1.2 1.2h-1.7a1.2 1.2 0 0 1-1.2-1.2v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 0 1-1.7 0L4.3 18a1.2 1.2 0 0 1 0-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6h-.2a1.2 1.2 0 0 1-1.2-1.2v-1.7a1.2 1.2 0 0 1 1.2-1.2h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 0 1 0-1.7L5.5 4a1.2 1.2 0 0 1 1.7 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9v-.2A1.2 1.2 0 0 1 10.2 2h1.7a1.2 1.2 0 0 1 1.2 1.2v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 0 1 1.7 0l1.2 1.2a1.2 1.2 0 0 1 0 1.7l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1.2 1.2 0 0 1 1.2 1.2v1.7a1.2 1.2 0 0 1-1.2 1.2h-.2a1 1 0 0 0-.9.6Z" />
                          </svg>
                          Gerenciar
                        </Link>
                        <details className="eventsIndexMoreMenu">
                          <summary aria-label={`Mais ações para ${event.title}`}>...</summary>
                          <div>
                            <Link href={`/admin/events/${event.id}/edit`}>Editar</Link>
                            <form action={duplicateEventAction}>
                              <input type="hidden" name="eventId" value={event.id} />
                              <button type="submit">Duplicar</button>
                            </form>
                          </div>
                        </details>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="eventsIndexPaginationBar">
              <span>
                Mostrando {filteredEvents.length === 0 ? 0 : startIndex + 1} a{" "}
                {Math.min(startIndex + pageSize, filteredEvents.length)} de {filteredEvents.length} evento(s)
              </span>

              <div className="eventsIndexPagination">
                <Link
                  aria-disabled={safePage <= 1}
                  className={`eventsIndexPageButton ${safePage <= 1 ? "isDisabled" : ""}`}
                  href={`/admin/events?${new URLSearchParams({
                    ...(query ? { q: query } : {}),
                    ...(selectedStatus !== "all" ? { status: selectedStatus } : {}),
                    ...(selectedDate !== "all" ? { date: selectedDate } : {}),
                    ...(selectedCity !== "all" ? { city: selectedCity } : {}),
                    page: String(Math.max(1, safePage - 1)),
                    pageSize: String(pageSize)
                  }).toString()}`}
                >
                  ‹
                </Link>
                {pagesToShow.map((pageNumber, index) => {
                  const previous = pagesToShow[index - 1];
                  const showGap = previous && pageNumber - previous > 1;

                  return (
                    <div className="eventsIndexPageGroup" key={pageNumber}>
                      {showGap ? <span className="eventsIndexPageGap">…</span> : null}
                      <Link
                        className={`eventsIndexPageButton ${pageNumber === safePage ? "isActive" : ""}`}
                        href={`/admin/events?${new URLSearchParams({
                          ...(query ? { q: query } : {}),
                          ...(selectedStatus !== "all" ? { status: selectedStatus } : {}),
                          ...(selectedDate !== "all" ? { date: selectedDate } : {}),
                          ...(selectedCity !== "all" ? { city: selectedCity } : {}),
                          page: String(pageNumber),
                          pageSize: String(pageSize)
                        }).toString()}`}
                      >
                        {pageNumber}
                      </Link>
                    </div>
                  );
                })}
                <Link
                  aria-disabled={safePage >= totalPages}
                  className={`eventsIndexPageButton ${safePage >= totalPages ? "isDisabled" : ""}`}
                  href={`/admin/events?${new URLSearchParams({
                    ...(query ? { q: query } : {}),
                    ...(selectedStatus !== "all" ? { status: selectedStatus } : {}),
                    ...(selectedDate !== "all" ? { date: selectedDate } : {}),
                    ...(selectedCity !== "all" ? { city: selectedCity } : {}),
                    page: String(Math.min(totalPages, safePage + 1)),
                    pageSize: String(pageSize)
                  }).toString()}`}
                >
                  ›
                </Link>
              </div>

              <form className="eventsIndexPageSizeField">
                <span>Eventos por página</span>
                <input type="hidden" name="q" value={query} />
                <input type="hidden" name="status" value={selectedStatus} />
                <input type="hidden" name="date" value={selectedDate} />
                <input type="hidden" name="city" value={selectedCity} />
                <select defaultValue={String(pageSize)} name="pageSize">
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="20">20</option>
                </select>
                <button className="secondaryButton smallButton" type="submit">
                  Aplicar
                </button>
              </form>
            </div>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}
