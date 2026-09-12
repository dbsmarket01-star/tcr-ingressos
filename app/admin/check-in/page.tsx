import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { validateTicketAction } from "@/features/check-in/check-in.actions";
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
  CANCELED: "Cancelado"
};

const statusInstructions = {
  APPROVED: "Entrada liberada. Pode seguir.",
  ALREADY_USED: "Bloqueie a entrada e confira o documento/pedido.",
  INVALID: "Não liberar entrada. Código não encontrado ou inválido.",
  CANCELED: "Não liberar entrada. Ingresso cancelado."
};

const emptyStats = {
  approvedToday: 0,
  blockedToday: 0,
  totalToday: 0
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
    selectedEvent ? getCheckInStats(admin.organizationId, scopedEventIds) : Promise.resolve(emptyStats)
  ]);
  const status = result.status as keyof typeof statusLabels | undefined;

  return (
    <AdminShell
      title={selectedEvent ? `Check-in — ${selectedEvent.title}` : "Check-in"}
      description={
        selectedEvent
          ? "Painel exclusivo deste evento: acompanhe as entradas e valide os ingressos."
          : "Selecione o evento para abrir o painel exclusivo de leitura e acompanhamento."
      }
    >
      <section className="checkInDeskPage">
        <section className="checkInEventSelectCard">
          {selectedEvent ? (
            <div className="checkInEventSelectForm">
              <div className="checkInEventSelectCopy">
                <span>Evento selecionado</span>
                <strong>{selectedEvent.title} — {formatEventOptionDate(selectedEvent.startsAt)}</strong>
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
          <div className="checkInEventStatusBox">
            <span className="checkInCalendarIcon" aria-hidden="true" />
            <p>
              {selectedEvent ? (
                <>
                  <strong>{selectedEvent.title}</strong>
                  <br />
                  {selectedEvent.venueName} - {selectedEvent.city}, {selectedEvent.state}
                </>
              ) : (
                <>
                  Selecione um evento ao lado
                  <br />
                  <strong>para iniciar o check-in.</strong>
                </>
              )}
            </p>
          </div>
        </section>

        {selectedEvent ? <><section className="checkInMetricGrid">
          <article className="checkInMetricCard">
            <span className="checkInMetricIcon checkInMetricGreen">E</span>
            <div>
              <span>Entradas hoje</span>
              <strong>{stats.approvedToday}</strong>
              <small>pessoas</small>
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
              <span>Histórico carregado</span>
              <strong>{recentCheckIns.length}</strong>
              <small>registros</small>
            </div>
          </article>
        </section>

        <section className="checkInWorkGrid">
          <article className="checkInMainPanel">
            <>
                {status ? (
                  <div className={`checkInCurrentResult checkIn${status}`} aria-live="polite">
                    <span>{statusLabels[status]}</span>
                    <strong>{statusInstructions[status]}</strong>
                    <p>{result.message}</p>
                    {result.ticket ? (
                      <div className="checkInResultSummary">
                        <span>Ingresso: <strong>{result.ticket}</strong></span>
                        <span>Comprador: <strong>{result.buyer}</strong></span>
                        <span>Lote: <strong>{result.lot}</strong></span>
                        {result.checkedAt ? <span>Horário: <strong>{formatDateTime(new Date(result.checkedAt))}</strong></span> : null}
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
                <CheckInScanner action={validateTicketAction} eventId={selectedEvent.id} eventTitle={selectedEvent.title} />
            </>
          </article>

          <aside className="checkInRecentPanel">
            <div className="checkInPanelTitle">
              <span className="checkInHistoryIcon" aria-hidden="true" />
              <h2>Últimos check-ins</h2>
            </div>
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
          </aside>
        </section></> : null}

        <section className="checkInTipsPanel">
          <h2>Dicas rápidas</h2>
          <div className="checkInTipsGrid">
            <article>
              <span className="checkInTipIcon checkInMetricBlue">1</span>
              <div>
                <strong>Cada ingresso só pode ser validado uma vez.</strong>
                <p>Releituras são bloqueadas automaticamente.</p>
              </div>
            </article>
            <article>
              <span className="checkInTipIcon checkInMetricGreen">2</span>
              <div>
                <strong>Mantenha sua conexão estável.</strong>
                <p>Isso garante sincronização em tempo real.</p>
              </div>
            </article>
            <article>
              <span className="checkInTipIcon checkInMetricGreen">3</span>
              <div>
                <strong>Problemas com a leitura?</strong>
                <p>Entre em contato com suporte imediato.</p>
              </div>
            </article>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}
