import { AdminShell } from "@/components/admin/AdminShell";
import { listAuditLogs } from "@/features/audit/audit.service";
import { requirePermission } from "@/features/auth/auth.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const actionLabels: Record<string, string> = {
  ADMIN_USER_CREATED: "Usuario criado",
  ADMIN_USER_ACTIVATED: "Usuario ativado",
  ADMIN_USER_DEACTIVATED: "Usuario desativado",
  ADMIN_USER_ROLE_UPDATED: "Papel alterado",
  ADMIN_PASSWORD_CHANGED: "Senha alterada",
  EVENT_DUPLICATED: "Evento duplicado",
  COMPANY_SETTINGS_UPDATED: "Configuracoes da empresa alteradas",
  ORDER_CANCELED_MANUALLY: "Pedido cancelado manualmente"
};

function formatMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return "-";
  }

  return JSON.stringify(metadata);
}

export default async function AdminAuditPage() {
  await requirePermission("AUDIT");
  const logs = await listAuditLogs();

  return (
    <AdminShell
      title="Auditoria"
      description="Acompanhe acoes sensiveis realizadas dentro do painel administrativo."
    >
      <section className="card">
        {logs.length === 0 ? (
          <div className="empty">Nenhum log administrativo registrado ainda.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Acao</th>
                <th>Usuario</th>
                <th>Entidade</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>
                    <strong>{actionLabels[log.action] || log.action}</strong>
                    <br />
                    <span className="muted">{log.action}</span>
                  </td>
                  <td>
                    {log.adminUser ? (
                      <>
                        <strong>{log.adminUser.name}</strong>
                        <br />
                        <span className="muted">{log.adminUser.email}</span>
                      </>
                    ) : (
                      <span className="muted">Sistema</span>
                    )}
                  </td>
                  <td>
                    <strong>{log.entityType}</strong>
                    <br />
                    <span className="muted breakText">{log.entityId || "-"}</span>
                  </td>
                  <td className="breakText">{formatMetadata(log.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
