import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getDeviceDiagnostics } from "@/features/security-center/device-risk.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    deviceId: string;
  }>;
};

export default async function DeviceDetailPage({ params }: PageProps) {
  await requirePermission("DEVICES");
  const organizationContext = await getCurrentOrganizationContext();

  if (!organizationContext.isPlatformHost) {
    notFound();
  }

  const { deviceId } = await params;
  const payload = await getDeviceDiagnostics(deviceId);

  if (!payload) {
    notFound();
  }

  const { device, diagnostics, timeline } = payload;

  return (
    <AdminShell
      title={device.nickname || device.platform}
      description="Linha do tempo técnica e operacional do dispositivo protegido."
    >
      <section className="statsGrid">
        <div className="statCard">
          <span>Risco</span>
          <strong>{device.riskLevel}</strong>
          <small>Atualizado em {device.riskUpdatedAt ? formatDateTime(device.riskUpdatedAt) : "-"}</small>
        </div>
        <div className="statCard">
          <span>Proteção</span>
          <strong>{device.protectionStatus}</strong>
          <small>{device.vpnEnabled ? "VPN ativa" : "VPN inativa"}</small>
        </div>
        <div className="statCard">
          <span>Heartbeat</span>
          <strong>{diagnostics.heartbeatAgeMinutes ?? "-"}</strong>
          <small>minutos desde o último sinal</small>
        </div>
        <div className="statCard">
          <span>Unlocks pendentes</span>
          <strong>{diagnostics.pendingUnlocks}</strong>
          <small>ações críticas aguardando parceiro</small>
        </div>
      </section>

      <section className="dashboardInsightsGrid">
        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Identidade do dispositivo</h2>
              <p>Dados principais para suporte e triagem.</p>
            </div>
          </div>
          <div className="chartLegend">
            <div>
              <strong>Usuário</strong>
              <small>
                {device.user.name} · {device.user.email}
              </small>
            </div>
            <div>
              <strong>Status comercial</strong>
              <small>{device.user.status}</small>
            </div>
            <div>
              <strong>Parceiro responsável</strong>
              <small>{device.user.accountabilityEmail || "não configurado"}</small>
            </div>
            <div>
              <strong>Plataforma</strong>
              <small>
                {device.platform} · {device.osVersion || "-"} · app {device.appVersion || "-"}
              </small>
            </div>
            <div>
              <strong>Integridade local</strong>
              <small>
                {device.developerModeDetected ? "developer mode ativo" : "developer mode ok"} ·{" "}
                {device.externalVpnDetected ? "vpn externa detectada" : "sem vpn externa"}
              </small>
            </div>
          </div>
        </div>

        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Resumo operacional</h2>
              <p>Sinais rápidos para ação.</p>
            </div>
          </div>
          <div className="chartLegend">
            <div>
              <strong>Eventos de bloqueio</strong>
              <small>{diagnostics.recentBlockedEvents} na amostra recente</small>
            </div>
            <div>
              <strong>Incidentes abertos</strong>
              <small>{diagnostics.unresolvedIncidents}</small>
            </div>
            <div>
              <strong>Último heartbeat</strong>
              <small>{device.lastHeartbeatAt ? formatDateTime(device.lastHeartbeatAt) : "sem heartbeat"}</small>
            </div>
            <div>
              <strong>Modo protegido</strong>
              <small>{device.protectedByPin ? "PIN ativo" : "PIN ausente"}</small>
            </div>
            <div>
              <strong>Proteção contra remoção</strong>
              <small>{device.uninstallGuardEnabled ? "ativa" : "inativa"}</small>
            </div>
          </div>
        </div>

        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Sinais ativos</h2>
              <p>Leitura rápida do que merece atenção imediata.</p>
            </div>
          </div>
          <div className="chartLegend">
            <div>
              <strong>VPN externa</strong>
              <small>{device.externalVpnDetected ? "detectada" : "não detectada"}</small>
            </div>
            <div>
              <strong>Developer mode</strong>
              <small>{device.developerModeDetected ? "ativo" : "normal"}</small>
            </div>
            <div>
              <strong>PIN local</strong>
              <small>{device.protectedByPin ? "presente" : "ausente"}</small>
            </div>
            <div>
              <strong>Proteção contra remoção</strong>
              <small>{device.uninstallGuardEnabled ? "ativa" : "inativa"}</small>
            </div>
            <div>
              <strong>Heartbeat atual</strong>
              <small>
                {diagnostics.heartbeatAgeMinutes == null
                  ? "sem dados"
                  : `${diagnostics.heartbeatAgeMinutes} min atrás`}
              </small>
            </div>
          </div>
        </div>

        {device.platform === "IOS" ? (
          <div className="dashboardPanel">
            <div className="sectionHeader inlineHeader">
              <div>
                <h2>Leitura iOS</h2>
                <p>Contexto operacional específico da Apple para este aparelho.</p>
              </div>
            </div>
            <div className="chartLegend">
              <div>
                <strong>Modo de proteção</strong>
                <small>{device.protectionMode}</small>
              </div>
              <div>
                <strong>App Group</strong>
                <small>
                  {diagnostics.latestHeartbeatMetadata?.appGroupConfigured ? "configurado" : "pendente"}
                </small>
              </div>
              <div>
                <strong>Target da extensão</strong>
                <small>
                  {diagnostics.latestHeartbeatMetadata?.extensionTargetReady ? "pronto" : "pendente"}
                </small>
              </div>
              <div>
                <strong>Extensão em execução</strong>
                <small>
                  {diagnostics.latestHeartbeatMetadata?.extensionRunning ? "ativa" : "inativa"}
                </small>
              </div>
              <div>
                <strong>Estado operacional</strong>
                <small>{diagnostics.latestHeartbeatMetadata?.extensionOperationalState ?? "-"}</small>
              </div>
              <div>
                <strong>Última atualização da extensão</strong>
                <small>{diagnostics.latestHeartbeatMetadata?.extensionLastUpdatedAt ?? "-"}</small>
              </div>
              <div>
                <strong>Último motivo de parada</strong>
                <small>{diagnostics.latestHeartbeatMetadata?.extensionStopReason ?? "-"}</small>
              </div>
              <div>
                <strong>Expectativa</strong>
                <small>Network Extension / DNS Proxy ativo e reportando heartbeat.</small>
              </div>
              <div>
                <strong>Anti-bypass realista</strong>
                <small>Observabilidade, unlock supervisionado e resposta operacional.</small>
              </div>
              <div>
                <strong>Último estado conhecido</strong>
                <small>{device.protectionStatus}</small>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="dashboardPanel">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Linha do tempo unificada</h2>
            <p>Ciclo consolidado entre eventos, incidentes e unlocks.</p>
          </div>
        </div>
        <div className="tableScroll">
          <table className="table operationalTable">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Categoria</th>
                <th>Rótulo</th>
                <th>Nível</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {timeline.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nenhum item consolidado.</td>
                </tr>
              ) : (
                timeline.map((item) => (
                  <tr key={`${item.kind}-${item.id}`}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>{item.kind}</td>
                    <td>{item.label}</td>
                    <td>{item.severity}</td>
                    <td>{item.detail || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboardPanel">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Eventos recentes</h2>
            <p>Bloqueios, heartbeats e sinais do dispositivo.</p>
          </div>
        </div>
        <div className="tableScroll">
          <table className="table operationalTable">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Tipo</th>
                <th>Severidade</th>
                <th>Valor</th>
                <th>Regra</th>
              </tr>
            </thead>
            <tbody>
              {device.protectionEvents.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nenhum evento recente.</td>
                </tr>
              ) : (
                device.protectionEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.createdAt)}</td>
                    <td>{event.type}</td>
                    <td>{event.severity}</td>
                    <td>{event.blockedValue || "-"}</td>
                    <td>{event.matchedRule || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboardInsightsGrid">
        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Incidentes</h2>
              <p>Falhas e sinais de bypass associados ao aparelho.</p>
            </div>
          </div>
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Severidade</th>
                  <th>Título</th>
                  <th>Resolvido</th>
                </tr>
              </thead>
              <tbody>
                {device.bypassIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Nenhum incidente.</td>
                  </tr>
                ) : (
                  device.bypassIncidents.map((incident) => (
                    <tr key={incident.id}>
                      <td>{formatDateTime(incident.createdAt)}</td>
                      <td>{incident.severity}</td>
                      <td>{incident.title}</td>
                      <td>{incident.resolvedAt ? formatDateTime(incident.resolvedAt) : "Aberto"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Unlocks supervisionados</h2>
              <p>Histórico das ações críticas aprovadas ou negadas.</p>
            </div>
          </div>
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Ação</th>
                  <th>Status</th>
                  <th>Cooldown</th>
                </tr>
              </thead>
              <tbody>
                {device.unlockRequests.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Nenhuma solicitação.</td>
                  </tr>
                ) : (
                  device.unlockRequests.map((request) => (
                    <tr key={request.id}>
                      <td>{formatDateTime(request.createdAt)}</td>
                      <td>{request.actionType}</td>
                      <td>{request.status}</td>
                      <td>{request.cooldownEndsAt ? formatDateTime(request.cooldownEndsAt) : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
