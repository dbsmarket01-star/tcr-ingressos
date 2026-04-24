import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { validateTicketAction } from "@/features/check-in/check-in.actions";
import { getCheckInStats, listRecentCheckIns } from "@/features/check-in/check-in.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
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

export default async function CheckInPage({ searchParams }: CheckInPageProps) {
  const admin = await requirePermission("CHECKIN");
  const organizationContext = await getCurrentOrganizationContext();
  const result = await searchParams;
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const [recentCheckIns, stats] = await Promise.all([
    listRecentCheckIns(allowedEventIds),
    getCheckInStats(allowedEventIds)
  ]);
  const status = result.status as keyof typeof statusLabels | undefined;

  return (
    <AdminShell
      title="Check-in"
      description="Valide QR Code com rapidez, bloqueie reutilização e mantenha a porta fluindo."
    >
      <section className="operationCommandStrip spacedSection" aria-label="Atalhos da área de check-in">
        <article className="operationCommandCard">
          <span className="eyebrow">Operação de portaria</span>
          <h2>Entrada rápida e leitura segura para a {organizationContext.brandName}</h2>
          <p>O foco aqui é manter a fila fluindo, bloquear reutilização e ter um caminho claro quando o QR Code falhar.</p>
        </article>
        <div className="operationCommandActions">
          <Link className="secondaryButton smallButton" href="/admin">
            Dashboard
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/support">
            Atendimento
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/tickets">
            Ingressos
          </Link>
        </div>
      </section>

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
          <span className="muted">Histórico carregado</span>
          <strong>{recentCheckIns.length}</strong>
        </article>
      </section>

      <section className="card spacedSection checkInOpsBar">
        <div>
          <span>Fluxo da portaria</span>
          <strong>Ler QR Code, conferir resultado e liberar apenas se aparecer Válido.</strong>
        </div>
        <div>
          <span>Reutilização</span>
          <strong>Se aparecer Já usado, bloqueie a entrada e acione o responsável.</strong>
        </div>
        <div>
          <span>Plano B</span>
          <strong>Sem câmera, digite ou cole o código do ingresso manualmente.</strong>
        </div>
      </section>

      <section className="operationsAlertGrid spacedSection">
        <article className="operationAlert">
          <span>Quando aparecer válido</span>
          <strong>Liberar entrada</strong>
          <p>Confirme rapidamente nome ou lote se quiser uma checagem extra.</p>
        </article>
        <article className="operationAlert warning">
          <span>Quando aparecer já usado</span>
          <strong>Segurar a entrada</strong>
          <p>Conferir documento e acionar o atendimento antes de qualquer liberação.</p>
        </article>
        <article className="operationAlert danger">
          <span>Quando aparecer inválido ou cancelado</span>
          <strong>Não liberar</strong>
          <p>Oriente o cliente a procurar suporte com o pedido ou o e-mail do ingresso.</p>
        </article>
      </section>

      <section className="grid twoColumns spacedSection">
        <CheckInScanner action={validateTicketAction} />

        <aside className={`card checkInResult ${status ? `checkIn${status}` : ""}`} aria-live="polite">
          <h2>Leitura atual</h2>
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
                      <span>Horário</span>
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
              <p>Abra a câmera ou cole o código do ingresso para começar. O resultado aparece aqui com a orientação do que fazer na hora.</p>
            </div>
          )}
        </aside>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Histórico recente</h2>
            <p className="muted">Use este histórico para confirmar rapidamente o que acabou de acontecer na porta.</p>
          </div>
          <Link className="secondaryButton smallButton" href="/admin/support">
            Abrir atendimento
          </Link>
        </div>

        {recentCheckIns.length === 0 ? (
          <div className="empty">Nenhum check-in registrado ainda.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Horário</th>
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
