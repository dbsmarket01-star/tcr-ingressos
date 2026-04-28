import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getDeviceRiskOverview } from "@/features/security-center/device-risk.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  await requirePermission("DEVICES");
  const organizationContext = await getCurrentOrganizationContext();

  if (!organizationContext.isPlatformHost) {
    notFound();
  }

  const overview = await getDeviceRiskOverview();
  const devices = overview.devices;

  return (
    <AdminShell
      title="Dispositivos"
      description="Inventário de instalações protegidas, heartbeat, integridade e sinais de evasão."
    >
      <section className="dashboardPanel">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Base de dispositivos</h2>
            <p>Controle por assinatura e visibilidade operacional.</p>
          </div>
        </div>
        {devices.length === 0 ? (
          <div className="empty">Nenhum dispositivo registrado.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Dispositivo</th>
                  <th>Usuário</th>
                  <th>Plataforma</th>
                  <th>Status</th>
                  <th>Proteção</th>
                  <th>Risco</th>
                  <th>VPN</th>
                  <th>VPN externa</th>
                  <th>Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device: any) => (
                  <tr key={device.id}>
                    <td>
                      <Link href={`/admin/devices/${device.id}`}>{device.nickname || "Sem apelido"}</Link>
                    </td>
                    <td>
                      {device.user.name}
                      <br />
                      <span className="muted">{device.user.email}</span>
                    </td>
                    <td>{device.platform}</td>
                    <td>{device.status}</td>
                    <td>{device.protectionStatus}</td>
                    <td>{device.riskLevel}</td>
                    <td>{device.vpnEnabled ? "Ativa" : "Inativa"}</td>
                    <td>{device.externalVpnDetected ? "Detectada" : "Não"}</td>
                    <td>{device.lastHeartbeatAt ? formatDateTime(device.lastHeartbeatAt) : "Sem heartbeat"}</td>
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
            <h2>Desbloqueios supervisionados</h2>
            <p>Pedidos pendentes para ações críticas que exigem aprovação externa.</p>
          </div>
          <Link className="secondaryButton" href="/admin/unlocks">
            Ver fila completa
          </Link>
        </div>
        {overview.pendingUnlockRequests.length === 0 ? (
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
                  <th>Expira em</th>
                </tr>
              </thead>
              <tbody>
                {overview.pendingUnlockRequests.map((request: any) => (
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
