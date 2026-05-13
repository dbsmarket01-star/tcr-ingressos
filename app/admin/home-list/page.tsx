import Link from "next/link";
import { HomeListStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { PrintButton } from "@/components/forms/PrintButton";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { updateHomeListEntryAction } from "@/features/hospitality/home-list.actions";
import { getHomeListFilterOptions, listHomeListEntries } from "@/features/hospitality/home-list.service";
import { formatDateInput } from "@/lib/format";

export const dynamic = "force-dynamic";

type HomeListPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels: Record<HomeListStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELED: "Cancelado"
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value?: string | string[]) {
  const status = firstParam(value);

  if (status === HomeListStatus.PENDING || status === HomeListStatus.CONFIRMED || status === HomeListStatus.CANCELED) {
    return status;
  }

  return null;
}

function buildQuery(filters: {
  eventId?: string | null;
  hotelId?: string | null;
  status?: HomeListStatus | null;
  search?: string | null;
}) {
  const params = new URLSearchParams();

  if (filters.eventId) params.set("eventId", filters.eventId);
  if (filters.hotelId) params.set("hotelId", filters.hotelId);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);

  return params.toString();
}

export default async function HomeListPage({ searchParams }: HomeListPageProps) {
  const admin = await requirePermission("REPORTS");
  const query = searchParams ? await searchParams : {};
  const filters = {
    eventId: firstParam(query.eventId) || null,
    hotelId: firstParam(query.hotelId) || null,
    status: parseStatus(query.status),
    search: firstParam(query.search) || null
  };
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const [entries, filterOptions] = await Promise.all([
    listHomeListEntries(admin.organizationId, filters, allowedEventIds),
    getHomeListFilterOptions(admin.organizationId, allowedEventIds)
  ]);
  const queryString = buildQuery(filters);
  const returnTo = `/admin/home-list${queryString ? `?${queryString}` : ""}`;
  const saved = firstParam(query.saved) === "1";
  const error = firstParam(query.error);

  return (
    <AdminShell
      title="Home List"
      description="Hospedagem por evento e hotel, gerada automaticamente após pagamento aprovado."
    >
      {saved ? <div className="successBox spacedSection">Registro atualizado com sucesso.</div> : null}
      {error ? <div className="errorBox spacedSection">{error}</div> : null}

      <section className="card homeListToolbar">
        <form className="homeListFilters" method="get">
          <label className="field">
            <span>Evento</span>
            <select name="eventId" defaultValue={filters.eventId ?? ""}>
              <option value="">Todos</option>
              {filterOptions.events.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Hotel</span>
            <select name="hotelId" defaultValue={filters.hotelId ?? ""}>
              <option value="">Todos</option>
              {filterOptions.hotels.map((hotel) => (
                <option value={hotel.id} key={hotel.id}>
                  {hotel.name} - {hotel.city}/{hotel.state}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Busca</span>
            <input name="search" defaultValue={filters.search ?? ""} placeholder="Nome, CPF, quarto ou observação" />
          </label>
          <div className="homeListFilterActions">
            <button className="button" type="submit">
              Filtrar
            </button>
            <Link className="secondaryButton" href="/admin/home-list">
              Limpar
            </Link>
          </div>
        </form>

        <div className="homeListExportActions">
          <Link className="secondaryButton" href={`/admin/home-list/export${queryString ? `?${queryString}` : ""}`}>
            Exportar Excel
          </Link>
          <Link className="secondaryButton" href={`/admin/home-list/export/pdf${queryString ? `?${queryString}` : ""}`}>
            Exportar PDF
          </Link>
          <PrintButton />
        </div>
      </section>

      <section className="homeListSummaryGrid">
        <article className="metric card">
          <span>Registros</span>
          <strong>{entries.length}</strong>
          <small>Hospedagens listadas</small>
        </article>
        <article className="metric card">
          <span>Confirmados</span>
          <strong>{entries.filter((entry) => entry.status === HomeListStatus.CONFIRMED).length}</strong>
          <small>Após pagamento aprovado</small>
        </article>
        <article className="metric card">
          <span>Pendentes</span>
          <strong>{entries.filter((entry) => entry.status === HomeListStatus.PENDING).length}</strong>
          <small>Ajuste operacional</small>
        </article>
        <article className="metric card">
          <span>Cancelados</span>
          <strong>{entries.filter((entry) => entry.status === HomeListStatus.CANCELED).length}</strong>
          <small>Pedido cancelado ou reembolsado</small>
        </article>
      </section>

      <section className="homeListEntries">
        {entries.length === 0 ? (
          <div className="emptyState card">
            <h2>Nenhuma hospedagem encontrada</h2>
            <p className="muted">A Home List aparece aqui automaticamente quando um pedido com hotel tiver pagamento aprovado.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <form action={updateHomeListEntryAction} className="card homeListEntryCard" key={entry.id}>
              <input type="hidden" name="entryId" value={entry.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="homeListEntryHeader">
                <div className="homeListEntryTitle">
                  <div className="homeListEntryTitleMeta">
                    <span className={`status ${entry.status === HomeListStatus.CONFIRMED ? "statusOk" : entry.status === HomeListStatus.CANCELED ? "statusDanger" : "statusWarning"}`}>
                      {statusLabels[entry.status]}
                    </span>
                    <span className="homeListRoomBadge">Quarto {entry.roomNumber || "a definir"}</span>
                  </div>
                  <h2>{entry.hotel.name}</h2>
                  <p>{entry.event.title}</p>
                </div>
                <div className="homeListEntryControls">
                  <label className="field">
                    <span>Status</span>
                    <select name="status" defaultValue={entry.status}>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Quarto</span>
                    <input name="roomNumber" defaultValue={entry.roomNumber ?? ""} placeholder="Ex: 204" />
                  </label>
                </div>
              </div>

              <div className="homeListMetaGrid">
                <div>
                  <span>Evento</span>
                  <strong>{entry.event.title}</strong>
                </div>
                <div>
                  <span>Hotel</span>
                  <strong>
                    {entry.hotel.name} - {entry.hotel.city}/{entry.hotel.state}
                  </strong>
                </div>
                <div>
                  <span>Ingresso</span>
                  <strong>{entry.lot.name}</strong>
                </div>
              </div>

              <div className="homeListGuestGrid">
                <section>
                  <h3>Hóspede 1</h3>
                  <label className="field">
                    <span>Nome completo</span>
                    <input name="guest1Name" defaultValue={entry.guest1Name} required />
                  </label>
                  <label className="field">
                    <span>CPF</span>
                    <input name="guest1Document" defaultValue={entry.guest1Document} required />
                  </label>
                  <label className="field">
                    <span>Data de nascimento</span>
                    <input name="guest1BirthDate" type="date" defaultValue={formatDateInput(entry.guest1BirthDate)} required />
                  </label>
                  <label className="field">
                    <span>E-mail</span>
                    <input name="guest1Email" type="email" defaultValue={entry.guest1Email} required />
                  </label>
                  <label className="field">
                    <span>Telefone</span>
                    <input name="guest1Phone" defaultValue={entry.guest1Phone} required />
                  </label>
                </section>
                <section>
                  <h3>Hóspede 2</h3>
                  <label className="field">
                    <span>Nome completo</span>
                    <input name="guest2Name" defaultValue={entry.guest2Name} required />
                  </label>
                  <label className="field">
                    <span>CPF</span>
                    <input name="guest2Document" defaultValue={entry.guest2Document} required />
                  </label>
                  <label className="field">
                    <span>Data de nascimento</span>
                    <input name="guest2BirthDate" type="date" defaultValue={formatDateInput(entry.guest2BirthDate)} required />
                  </label>
                </section>
              </div>

              <label className="homeListNotesField">
                <span>Observações para o hotel</span>
                <textarea
                  name="notes"
                  defaultValue={entry.notes ?? ""}
                  placeholder="Ex.: casal palestrante, quarto com suíte, duas camas extras, preferência por cama de casal..."
                  rows={3}
                />
              </label>

              <div className="formActions">
                <button className="button" type="submit">
                  Salvar alterações
                </button>
              </div>
            </form>
          ))
        )}
      </section>
    </AdminShell>
  );
}
