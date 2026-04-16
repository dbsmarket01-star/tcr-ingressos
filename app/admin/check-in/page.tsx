import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { validateTicketAction } from "@/features/check-in/check-in.actions";
import { getCheckInStats, listRecentCheckIns } from "@/features/check-in/check-in.service";
import { formatDateTime } from "@/lib/format";
import { CheckInScanner } from "./CheckInScanner";

export const dynamic = "force-dynamic";

type CheckInPageProps = {
  searchParams: Promise<{
    status?: string;
    message?: string;
    ticket?: string;
    event?: string;
    lot?: string;
    buyer?: string;
    checkedAt?: string;
  }>;
};

const statusLabels = {
  APPROVED: "Valido",
  ALREADY_USED: "Ja usado",
  INVALID: "Invalido",
  CANCELED: "Cancelado"
};

const statusInstructions = {
  APPROVED: "Entrada liberada. Pode seguir.",
  ALREADY_USED: "Bloqueie a entrada e confira o documento/pedido.",
  INVALID: "Nao liberar entrada. Codigo nao encontrado ou invalido.",
  CANCELED: "Nao liberar entrada. Ingresso cancelado."
};

export default async function CheckInPage({ searchParams }: CheckInPageProps) {
  await requirePermission("CHECKIN");
  const result = await searchParams;
  const [recentCheckIns, stats] = await Promise.all([listRecentCheckIns(), getCheckInStats()]);
  const status = result.status as keyof typeof statusLabels | undefined;

  return (
    <AdminShell
      title="Check-in"
      description="Valide codigo ou token de QR Code, marque entrada e bloqueie reutilizacao."
    >
      <section className="grid dashboardGrid">
        <article className="card metric">
          <span className="muted">Entradas hoje</span>
          <strong>{stats.approvedToday}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Bloqueios hoje</span>
          <strong>{stats.blockedToday}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Leituras hoje</span>
          <strong>{stats.totalToday}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Historico carregado</span>
          <strong>{recentCheckIns.length}</strong>
        </article>
      </section>

      <section className="card spacedSection checkInOpsBar">
        <div>
          <span>Fluxo da portaria</span>
          <strong>Ler QR Code, conferir resultado e liberar apenas se aparecer Valido.</strong>
        </div>
        <div>
          <span>Reutilizacao</span>
          <strong>Se aparecer Ja usado, bloqueie a entrada e acione o responsavel.</strong>
        </div>
        <div>
          <span>Plano B</span>
          <strong>Sem camera, digite ou cole o codigo do ingresso manualmente.</strong>
        </div>
      </section>

      <section className="grid twoColumns spacedSection">
        <CheckInScanner action={validateTicketAction} />

        <aside className={`card checkInResult ${status ? `checkIn${status}` : ""}`} aria-live="polite">
          <h2>Resultado</h2>
          {status ? (
            <>
              <div className="checkInDecision">
                <span>{statusLabels[status]}</span>
                <strong>{statusInstructions[status]}</strong>
                <p>{result.message}</p>
              </div>
              {result.ticket ? (
                <div className="paymentBox">
                  <div className="summaryLine">
                    <span>Ingresso</span>
                    <strong>{result.ticket}</strong>
                  </div>
                  <div className="summaryLine">
                    <span>Evento</span>
                    <strong>{result.event}</strong>
                  </div>
                  <div className="summaryLine">
                    <span>Lote</span>
                    <strong>{result.lot}</strong>
                  </div>
                  <div className="summaryLine">
                    <span>Comprador</span>
                    <strong>{result.buyer}</strong>
                  </div>
                  {result.checkedAt ? (
                    <div className="summaryLine">
                      <span>Horario</span>
                      <strong>{formatDateTime(new Date(result.checkedAt))}</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="checkInResultActions">
                {result.ticket ? (
                  <a className="secondaryButton fullButton" href={`/ingresso/${result.ticket}`}>
                    Abrir ingresso
                  </a>
                ) : null}
                <a className="button fullButton" href="/admin/check-in">
                  Nova leitura
                </a>
              </div>
            </>
          ) : (
            <div className="checkInIdle">
              <strong>Nenhuma leitura realizada ainda.</strong>
              <p>Abra a camera ou cole o codigo do ingresso para iniciar a validacao.</p>
            </div>
          )}
        </aside>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Historico recente</h2>
        </div>

        {recentCheckIns.length === 0 ? (
          <div className="empty">Nenhum check-in registrado ainda.</div>
        ) : (
          <div className="tableScroll">
          <table className="table operationalTable">
            <thead>
              <tr>
                <th>Horario</th>
                <th>Status</th>
                <th>Evento</th>
                <th>Ingresso</th>
                <th>Comprador</th>
                <th>Dispositivo</th>
              </tr>
            </thead>
            <tbody>
              {recentCheckIns.map((checkIn) => (
                <tr key={checkIn.id}>
                  <td>{formatDateTime(checkIn.checkedAt)}</td>
                  <td>
                    <span
                      className={`status ${
                        checkIn.status === "APPROVED" ? "published" : "draft"
                      }`}
                    >
                      {statusLabels[checkIn.status]}
                    </span>
                  </td>
                  <td>{checkIn.event.title}</td>
                  <td>
                    <strong>{checkIn.ticket.code}</strong>
                    <br />
                    <span className="muted">{checkIn.ticket.lot.name}</span>
                  </td>
                  <td>{checkIn.ticket.order.customer.name}</td>
                  <td>{checkIn.deviceName ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
