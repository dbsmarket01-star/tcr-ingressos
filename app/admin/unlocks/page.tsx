import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { resolveUnlockRequestAction } from "@/features/protection-unlock/unlock-request.actions";
import { listUnlockRequests } from "@/features/protection-unlock/unlock-request.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type UnlocksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  DENIED: "Negada",
  EXPIRED: "Expirada",
  CANCELED: "Encerrada"
};

export default async function UnlocksPage({ searchParams }: UnlocksPageProps) {
  await requirePermission("INCIDENTS");
  const organizationContext = await getCurrentOrganizationContext();

  if (!organizationContext.isPlatformHost) {
    notFound();
  }

  const params = searchParams ? await searchParams : {};
  const error = typeof params.error === "string" ? params.error : null;
  const resolved = typeof params.resolved === "string" ? params.resolved : null;

  const requests = await listUnlockRequests({ limit: 120 });
  const pendingCount = requests.filter((request: any) => request.status === "PENDING").length;
  const approvedCount = requests.filter((request: any) => request.status === "APPROVED").length;

  return (
    <AdminShell
      title="Desbloqueios"
      description="Fila supervisionada para ações críticas, cooldown, aprovações e encerramentos operacionais."
    >
      <section className="grid dashboardGrid dashboardPrimaryGrid" aria-label="Resumo de desbloqueios">
        <article className="card metric dashboardHeroMetric">
          <span className="muted">Pendentes</span>
          <strong>{pendingCount}</strong>
          <small>Pedidos aguardando resposta do parceiro ou do time.</small>
        </article>
        <article className="card metric">
          <span className="muted">Aprovadas</span>
          <strong>{approvedCount}</strong>
          <small>Liberações em janela ativa ou cooldown.</small>
        </article>
        <article className="card metric">
          <span className="muted">Histórico</span>
          <strong>{requests.length}</strong>
          <small>Últimas solicitações carregadas nesta central.</small>
        </article>
      </section>

      <section className="dashboardPanel">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Fila supervisionada</h2>
            <p>O parceiro aprova por código; aqui o time acompanha, encerra ou nega quando necessário.</p>
          </div>
          <Link className="secondaryButton" href="/admin/incidents">
            Ver incidentes
          </Link>
        </div>

        {error ? <div className="errorBox">{error}</div> : null}
        {resolved ? (
          <div className="successBox">
            Solicitação {resolved === "denied" ? "negada" : "encerrada"} com sucesso.
          </div>
        ) : null}

        {requests.length === 0 ? (
          <div className="empty">Nenhuma solicitação registrada ainda.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Ação</th>
                  <th>Usuário</th>
                  <th>Parceiro</th>
                  <th>Dispositivo</th>
                  <th>Criada em</th>
                  <th>Expira</th>
                  <th>Cooldown</th>
                  <th>Motivo</th>
                  <th>Operação</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request: any) => (
                  <tr key={request.id}>
                    <td>{statusLabels[request.status] ?? request.status}</td>
                    <td>{request.actionType}</td>
                    <td>
                      {request.user.name}
                      <br />
                      <span className="muted">{request.user.email}</span>
                    </td>
                    <td>{request.partnerEmail}</td>
                    <td>{request.device?.nickname || request.device?.platform || "-"}</td>
                    <td>{formatDateTime(request.createdAt)}</td>
                    <td>{formatDateTime(request.expiresAt)}</td>
                    <td>{request.cooldownEndsAt ? formatDateTime(request.cooldownEndsAt) : "-"}</td>
                    <td>{request.reason || "-"}</td>
                    <td>
                      {["PENDING", "APPROVED"].includes(request.status) ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <form action={resolveUnlockRequestAction}>
                            <input type="hidden" name="unlockRequestId" value={request.id} />
                            <input type="hidden" name="resolution" value="DENIED" />
                            <input
                              name="note"
                              placeholder="Nota opcional"
                              defaultValue=""
                              style={{ width: "100%", marginBottom: 8 }}
                            />
                            <button className="secondaryButton smallButton" type="submit">
                              Negar
                            </button>
                          </form>
                          <form action={resolveUnlockRequestAction}>
                            <input type="hidden" name="unlockRequestId" value={request.id} />
                            <input type="hidden" name="resolution" value="CANCELED" />
                            <input
                              name="note"
                              placeholder="Motivo do encerramento"
                              defaultValue=""
                              style={{ width: "100%", marginBottom: 8 }}
                            />
                            <button className="secondaryButton smallButton" type="submit">
                              Encerrar
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="muted">Fechada</span>
                      )}
                    </td>
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
