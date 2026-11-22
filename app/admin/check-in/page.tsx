import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { validateTicketContinuouslyAction } from "@/features/check-in/check-in.actions";
import { getCheckInStats, listCheckInEvents, listRecentCheckIns } from "@/features/check-in/check-in.service";
import { formatDateTime } from "@/lib/format";
import { CheckInScanner } from "./CheckInScanner";

export const dynamic = "force-dynamic";

type CheckInPageProps = {
  searchParams: Promise<{
    status?: string;
    message?: string;
    ticket?: string;
    ticketUrl?: string;
    event?: string;
    eventId?: string;
    lot?: string;
    buyer?: string;
    checkedAt?: string;
  }>;
};

const statusLabels = {
  APPROVED: "Válido",
  ALREADY_USED: "Já usado",
  INVALID: "Inválido",
  CANCELED: "Cancelado",
  ERROR: "Falha na validação"
};

const statusInstructions = {
  APPROVED: "Pode seguir",
  ALREADY_USED: "Bloqueie a entrada",
  INVALID: "Não libere a entrada",
  CANCELED: "Não libere a entrada",
  ERROR: "Não libere ainda"
};

const statusEyebrows = {
  APPROVED: "Entrada liberada",
  ALREADY_USED: "Alerta · QR Code já usado",
  INVALID: "Alerta · QR Code inválido",
  CANCELED: "Alerta · Ingresso cancelado",
  ERROR: "Alerta · Validação não concluída"
};

const statusGuidance = {
  APPROVED: "Ingresso válido. Libere o acesso.",
  ALREADY_USED: "Este ingresso já foi validado. Confira o documento ou o pedido.",
  INVALID: "Código não encontrado. Confira o ingresso antes de tentar novamente.",
  CANCELED: "Este ingresso está cancelado e não permite acesso.",
  ERROR: "A validação não foi concluída. Verifique a conexão antes de tentar novamente."
};

const emptyStats = {
  approvedToday: 0,
  blockedToday: 0,
  totalToday: 0,
  approvedTotal: 0,
  operatorApprovedTotal: 0
};

function formatEventOptionDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function formatLotDisplayName(lotName: string, optionLabel?: string | null) {
  return optionLabel ? `${lotName} - ${optionLabel}` : lotName;
}

export default async function CheckInPage({ searchParams }: CheckInPageProps) {
  const admin = await requirePermission("CHECKIN");
  const result = await searchParams;
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const selectedEventId = result.eventId?.trim() ?? "";
  const eventOptions = await listCheckInEvents(admin.organizationId, allowedEventIds);
  const selectedEvent = eventOptions.find((event) => event.id === selectedEventId) ?? null;
  const scopedEventIds = selectedEvent ? [selectedEvent.id] : [];
  const [recentCheckIns, stats] = await Promise.all([
    selectedEvent ? listRecentCheckIns(admin.organizationId, scopedEventIds) : Promise.resolve([]),
    selectedEvent ? getCheckInStats(admin.organizationId, scopedEventIds, admin.id) : Promise.resolve(emptyStats)
  ]);
  const status = result.status && result.status in statusLabels
    ? result.status as keyof typeof statusLabels
    : undefined;

  return (
    <AdminShell
      title="Check-in"
      description={
        selectedEvent
          ? selectedEvent.title
          : "Selecione o evento para abrir o painel exclusivo de leitura e acompanhamento."
      }
    >
      <section className="checkInDeskPage">
        <section className={`checkInEventSelectCard${selectedEvent ? " checkInEventSelected" : ""}`}>
          {selectedEvent ? (
            <div className="checkInEventSelectForm">
              <div className="checkInEventSelectCopy">
                <span>Você está lendo</span>
                <strong>{selectedEvent.title} · {formatEventOptionDate(selectedEvent.startsAt)}</strong>
                <small>{selectedEvent.venueName} · {selectedEvent.city}, {selectedEvent.state}</small>
              </div>
              <div className="checkInSelectRow">
                <a className="secondaryButton checkInSelectButton" href="/admin/check-in">
                  Trocar evento
                </a>
              </div>
            </div>
          ) : (
            <form className="checkInEventSelectForm">
              <div className="checkInEventSelectCopy">
                <span>1. Selecione o evento</span>
                <strong>Os eventos estão organizados pela data, do mais próximo para o mais distante.</strong>
              </div>
              <div className="checkInSelectRow">
                <select aria-label="Selecionar evento para check-in" defaultValue="" name="eventId" required>
                  <option value="">Selecione o evento para iniciar o check-in</option>
                  {eventOptions.map((event) => (
                    <option key={event.id} value={event.id}>
                      {formatEventOptionDate(event.startsAt)} — {event.title}
                    </option>
                  ))}
                </select>
                <button className="button checkInSelectButton" type="submit">
                  Abrir painel do evento
                </button>
              </div>
            </form>
          )}
          {!selectedEvent ? <div className="checkInEventStatusBox">
            <span className="checkInCalendarIcon" aria-hidden="true" />
            <p>
              Selecione um evento ao lado
              <br />
              <strong>para iniciar o check-in.</strong>
            </p>
          </div> : null}
        </section>

        {selectedEvent ? <>

        <section className="checkInWorkGrid">
          <article className="checkInMainPanel">
            <>
                {status ? (
                  <div className={`checkInCurrentResult checkIn${status}`} role="alert" aria-live="assertive">
                    <div className="checkInResultHeadline">
                      <span>{statusEyebrows[status]}</span>
                      <strong>{statusInstructions[status]}</strong>
                    </div>
                    <p className="checkInResultMessage">{result.message || statusGuidance[status]}</p>
                    {result.ticket ? (
                      <div className="checkInResultSummary">
                        <span><small>Ingresso</small><strong>{result.ticket}</strong></span>
                        <span><small>Comprador</small><strong>{result.buyer}</strong></span>
                        <span><small>Lote</small><strong>{result.lot}</strong></span>
                        {result.checkedAt ? <span><small>{result.status === "ALREADY_USED" ? "Primeira validação" : "Horário"}</small><strong>{formatDateTime(new Date(result.checkedAt))}</strong></span> : null}
                      </div>
                    ) : null}
                    <div className="checkInResultActions">
                      {result.ticket && result.ticketUrl ? (
                        <a className="secondaryButton" href={result.ticketUrl} target="_blank" rel="noreferrer noopener">
                          Abrir ingresso
                        </a>
                      ) : null}
                      <a className="button" href={`/admin/check-in?eventId=${selectedEvent.id}`}>
                        Nova leitura
                      </a>
                    </div>
                  </div>
                ) : null}
                <CheckInScanner key={selectedEvent.id} action={validateTicketContinuouslyAction} eventId={selectedEvent.id} eventTitle={selectedEvent.title} />
            </>
          </article>

          <details className="checkInRecentPanel">
            <summary className="checkInPanelTitle">
              <span className="checkInHistoryIcon" aria-hidden="true" />
              <span>Últimos check-ins</span>
            </summary>
            {recentCheckIns.length === 0 ? (
              <div className="checkInRecentEmpty">
                <span aria-hidden="true" />
                <strong>Nenhuma leitura realizada ainda.</strong>
                <p>Os últimos check-ins aparecerão aqui.</p>
              </div>
            ) : (
              <div className="checkInRecentList">
                {recentCheckIns.slice(0, 8).map((checkIn) => (
                  <article className="checkInRecentItem" key={checkIn.id}>
                    <div>
                      <strong>{checkIn.ticket.order.customer.name}</strong>
                      <span>{formatLotDisplayName(checkIn.ticket.lot.name, checkIn.ticket.lotOption?.label)}</span>
                    </div>
                    <div>
                      <span className={`status ${checkIn.status === "APPROVED" ? "published" : "draft"}`}>
                        {statusLabels[checkIn.status]}
                      </span>
                      <small>{formatDateTime(checkIn.checkedAt)}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </details>
        </section></> : null}

        {selectedEvent ? <section className="checkInMetricGrid">
          <article className="checkInMetricCard">
            <span className="checkInMetricIcon checkInMetricGreen">E</span>
            <div>
              <span>Entradas no evento</span>
              <strong>{stats.approvedTotal}</strong>
              <small>validações acumuladas</small>
            </div>
          </article>
          <article className="checkInMetricCard">
            <span className="checkInMetricIcon checkInMetricRed">B</span>
            <div>
              <span>Bloqueios hoje</span>
              <strong>{stats.blockedToday}</strong>
              <small>tentativas</small>
            </div>
          </article>
          <article className="checkInMetricCard">
            <span className="checkInMetricIcon checkInMetricBlue">L</span>
            <div>
              <span>Leituras hoje</span>
              <strong>{stats.totalToday}</strong>
              <small>check-ins</small>
            </div>
          </article>
          <article className="checkInMetricCard">
            <span className="checkInMetricIcon checkInMetricPurple">H</span>
            <div>
              <span>Validados por você</span>
              <strong>{stats.operatorApprovedTotal}</strong>
              <small>total desta conta no evento</small>
            </div>
          </article>
        </section> : null}

      </section>
    </AdminShell>
  );
}
