import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { listPendingUnlockRequests } from "@/features/protection-unlock/unlock-request.service";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  await requirePermission("INCIDENTS");
  const organizationContext = await getCurrentOrganizationContext();

  if (!organizationContext.isPlatformHost) {
    notFound();
  }

  const [incidents, pendingUnlockRequests] = await Promise.all([
    prisma.bypassIncident.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: {
        user: {
          select: { name: true, email: true }
        },
        device: {
          select: { nickname: true, platform: true }
        }
      }
    }),
    listPendingUnlockRequests()
  ]);

  return (
    <AdminShell
      title="Incidentes"
      description="Tentativas de bypass, perda de protecao e sinais que exigem resposta do time."
    >
      <section className="dashboardPanel">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Fila operacional</h2>
            <p>Incidentes consolidados enviados pelos dispositivos e pelo backend.</p>
          </div>
        </div>
        {incidents.length === 0 ? (
          <div className="empty">Nenhum incidente registrado.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Severidade</th>
                  <th>Titulo</th>
                  <th>Descricao</th>
                  <th>Usuario</th>
                  <th>Dispositivo</th>
                  <th>Criado em</th>
                  <th>Resolvido</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident: any) => (
                  <tr key={incident.id}>
                    <td>{incident.severity}</td>
                    <td>{incident.title}</td>
                    <td>{incident.description}</td>
                    <td>{incident.user.name}</td>
                    <td>{incident.device?.nickname || incident.device?.platform || "-"}</td>
                    <td>{formatDateTime(incident.createdAt)}</td>
                    <td>{incident.resolvedAt ? formatDateTime(incident.resolvedAt) : "Aberto"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboardPanel">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Desbloqueios pendentes</h2>
            <p>Solicitações críticas aguardando aprovação do parceiro.</p>
          </div>
          <Link className="secondaryButton" href="/admin/unlocks">
            Abrir central
          </Link>
        </div>
        {pendingUnlockRequests.length === 0 ? (
          <div className="empty">Nenhuma solicitação pendente.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Ação</th>
                  <th>Usuário</th>
                  <th>Parceiro</th>
                  <th>Dispositivo</th>
                  <th>Expira</th>
                </tr>
              </thead>
              <tbody>
                {pendingUnlockRequests.map((request: any) => (
                  <tr key={request.id}>
                    <td>{request.actionType}</td>
                    <td>{request.user.name}</td>
                    <td>{request.partnerEmail}</td>
                    <td>{request.device?.nickname || request.device?.platform || "-"}</td>
                    <td>{formatDateTime(request.expiresAt)}</td>
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
