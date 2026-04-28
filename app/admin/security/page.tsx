import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getDeviceRiskOverview } from "@/features/security-center/device-risk.service";
import { getProtectionOverview } from "@/features/security-center/protection-overview.service";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const iosLimits = [
  "Dependencia de entitlement e revisao Apple para Network Extension.",
  "Sem o mesmo grau de anti-desinstalacao do Android em contexto consumer.",
  "Quedas da extensao devem virar alerta e status degradado no painel."
];

const iosOperationalLayers = [
  "App iOS compartilhando policy, heartbeat e unlock supervisionado",
  "DNS Proxy / Network Extension como núcleo da proteção local",
  "Incidente operacional quando a proteção iOS ficar degradada",
  "App Group entre app e extensão para compartilhar policy e estado local"
];

const androidLayers = [
  "VPN local obrigatoria no modo protegido",
  "DNS filtering remoto com cache local",
  "Deteccao de VPN externa, proxy e perda de heartbeat",
  "PIN para desativacao e alteracoes criticas"
];

export default async function SecurityPage() {
  await requirePermission("SECURITY");
  const organizationContext = await getCurrentOrganizationContext();

  if (!organizationContext.isPlatformHost) {
    notFound();
  }

  const [overview, deviceRisk] = await Promise.all([getProtectionOverview(), getDeviceRiskOverview()]);
  const riskSummary = Object.fromEntries(
    overview.riskBuckets.map((item: any) => [item.riskLevel, item._count._all])
  ) as Record<string, number>;
  const protectionSummary = Object.fromEntries(
    overview.protectionBuckets.map((item: any) => [item.protectionStatus, item._count._all])
  ) as Record<string, number>;
  const platformSummary = Object.fromEntries(
    overview.platformBuckets.map((item: any) => [item.platform, item._count._all])
  ) as Record<string, number>;

  return (
    <AdminShell
      title="Centro de protecao"
      description="Estrategia tecnica do bloqueio real, riscos por plataforma e foco operacional do MVP."
    >
      <section className="statsGrid">
        <div className="statCard">
          <span>Total de dispositivos</span>
          <strong>{overview.totalDevices}</strong>
          <small>Base protegida cadastrada</small>
        </div>
        <div className="statCard">
          <span>Risco critico</span>
          <strong>{riskSummary.CRITICAL ?? 0}</strong>
          <small>Exigem acao imediata</small>
        </div>
        <div className="statCard">
          <span>Protecao online</span>
          <strong>{protectionSummary.ONLINE ?? 0}</strong>
          <small>Dispositivos saudaveis</small>
        </div>
        <div className="statCard">
          <span>Unlocks pendentes</span>
          <strong>{overview.pendingUnlockCount}</strong>
          <small>Fila supervisionada ativa</small>
        </div>
      </section>

      <section className="dashboardInsightsGrid">
        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Android no MVP</h2>
              <p>Camada principal de bloqueio forte e anti-bypass.</p>
            </div>
          </div>
          <div className="chartLegend">
            {androidLayers.map((item) => (
              <div key={item}>
                <strong>Camada</strong>
                <small>{item}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>iOS no MVP</h2>
              <p>Melhor implementacao possivel dentro das regras da Apple.</p>
            </div>
          </div>
          <div className="chartLegend">
            {iosLimits.map((item) => (
              <div key={item}>
                <strong>Limite real</strong>
                <small>{item}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Distribuição por plataforma</h2>
              <p>Base protegida atual entre Android e iOS.</p>
            </div>
          </div>
          <div className="chartLegend">
            <div>
              <strong>Android</strong>
              <small>{platformSummary.ANDROID ?? 0} dispositivo(s)</small>
            </div>
            <div>
              <strong>iOS</strong>
              <small>{platformSummary.IOS ?? 0} dispositivo(s)</small>
            </div>
            <div>
              <strong>iOS online</strong>
              <small>{overview.iosOnlineCount} dispositivo(s)</small>
            </div>
            <div>
              <strong>Leitura operacional</strong>
              <small>
                {overview.iosDeviceCount === 0
                  ? "Ainda sem aparelhos iOS reportando no painel."
                  : "Base iOS já visível no centro de proteção."}
              </small>
            </div>
            <div>
              <strong>Incidentes iOS degradados</strong>
              <small>{overview.iosDegradedIncidentCount} incidente(s) abertos</small>
            </div>
            <div>
              <strong>Unlocks pendentes no iOS</strong>
              <small>{overview.iosPendingUnlockCount} solicitação(ões)</small>
            </div>
            <div>
              <strong>App Group reportado</strong>
              <small>{overview.iosAppGroupReadyCount} dispositivo(s)</small>
            </div>
            <div>
              <strong>Extensão pronta</strong>
              <small>{overview.iosExtensionReadyCount} dispositivo(s)</small>
            </div>
            <div>
              <strong>Extensão em execução</strong>
              <small>{overview.iosExtensionRunningCount} dispositivo(s)</small>
            </div>
            <div>
              <strong>Incidentes App Group</strong>
              <small>{overview.iosAppGroupIncidentCount} aberto(s)</small>
            </div>
            <div>
              <strong>Incidentes de extensão pronta</strong>
              <small>{overview.iosExtensionNotReadyIncidentCount} aberto(s)</small>
            </div>
            <div>
              <strong>Incidentes de extensão inativa</strong>
              <small>{overview.iosExtensionInactiveIncidentCount} aberto(s)</small>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboardInsightsGrid">
        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Planos cadastrados</h2>
              <p>Base de monetizacao para liberar dispositivos e recursos.</p>
            </div>
          </div>
          <div className="chartLegend">
            {overview.plans.length === 0 ? (
              <div>
                <strong>Sem planos</strong>
                <small>Cadastre os planos antes de abrir o trial.</small>
              </div>
            ) : (
              overview.plans.map((plan) => (
                <div key={plan.id}>
                  <strong>{plan.name}</strong>
                  <small>
                    {formatCurrency(plan.priceInCents)} · {plan.maxDevices} dispositivo(s) · trial de {plan.trialDays} dia(s)
                  </small>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Top eventos de protecao</h2>
              <p>Sinais de bloqueio e degradacao mais frequentes.</p>
            </div>
          </div>
          <div className="chartLegend">
            {overview.topEvents.length === 0 ? (
              <div>
                <strong>Sem telemetria</strong>
                <small>Os apps ainda nao enviaram eventos.</small>
              </div>
            ) : (
              overview.topEvents.map((event) => (
                <div key={event.type}>
                  <strong>{event.type}</strong>
                  <small>{event._count._all} evento(s)</small>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="dashboardInsightsGrid">
        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Resumo de risco</h2>
              <p>Distribuição rápida por nível operacional.</p>
            </div>
          </div>
          <div className="chartLegend">
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => (
              <div key={level}>
                <strong>{level}</strong>
                <small>{riskSummary[level] ?? 0} dispositivo(s)</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Saúde da proteção</h2>
              <p>Estados atuais dos dispositivos no campo.</p>
            </div>
          </div>
          <div className="chartLegend">
            {["ONLINE", "DEGRADED", "OFFLINE", "LOCKED"].map((status) => (
              <div key={status}>
                <strong>{status}</strong>
                <small>{protectionSummary[status] ?? 0} dispositivo(s)</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Operação iOS</h2>
              <p>Camadas que já estão sendo preparadas no produto.</p>
            </div>
          </div>
          <div className="chartLegend">
            {iosOperationalLayers.map((item) => (
              <div key={item}>
                <strong>Camada</strong>
                <small>{item}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboardPanel">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Dispositivos em risco</h2>
            <p>Visão rápida dos aparelhos que pedem ação operacional.</p>
          </div>
        </div>
        {deviceRisk.devices.length === 0 ? (
          <div className="empty">Nenhum dispositivo encontrado.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Dispositivo</th>
                  <th>Usuário</th>
                  <th>Risco</th>
                  <th>Proteção</th>
                  <th>Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {deviceRisk.devices.slice(0, 12).map((device: any) => (
                  <tr key={device.id}>
                    <td>{device.nickname || device.platform}</td>
                    <td>{device.user.name}</td>
                    <td>{device.riskLevel}</td>
                    <td>{device.protectionStatus}</td>
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
            <h2>Sinais críticos recorrentes</h2>
            <p>Incidentes mais frequentes da última semana.</p>
          </div>
        </div>
        {overview.criticalSignals.length === 0 ? (
          <div className="empty">Nenhum sinal crítico consolidado na última semana.</div>
        ) : (
          <div className="chartLegend">
            {overview.criticalSignals.map((signal: any) => (
              <div key={`${signal.title}-${signal.severity}`}>
                <strong>
                  {signal.title} · {signal.severity}
                </strong>
                <small>{signal._count._all} ocorrência(s)</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dashboardPanel">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Fila de incidentes</h2>
            <p>Ultimos alertas consolidados para triagem operacional.</p>
          </div>
        </div>
        {overview.recentIncidents.length === 0 ? (
          <div className="empty">Nenhum incidente consolidado.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Severidade</th>
                  <th>Titulo</th>
                  <th>Usuario</th>
                  <th>Dispositivo</th>
                  <th>Quando</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td>{incident.severity}</td>
                    <td>{incident.title}</td>
                    <td>{incident.user.name}</td>
                    <td>{incident.device?.nickname || incident.device?.platform || "-"}</td>
                    <td>{formatDateTime(incident.createdAt)}</td>
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
            <h2>Linha do tempo supervisionada</h2>
            <p>Últimas solicitações críticas entre parceiro, app e operação.</p>
          </div>
        </div>
        {overview.latestUnlockRequests.length === 0 ? (
          <div className="empty">Nenhuma solicitação supervisionada registrada.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Ação</th>
                  <th>Usuário</th>
                  <th>Dispositivo</th>
                  <th>Parceiro</th>
                  <th>Criada em</th>
                </tr>
              </thead>
              <tbody>
                {overview.latestUnlockRequests.map((request: any) => (
                  <tr key={request.id}>
                    <td>{request.status}</td>
                    <td>{request.actionType}</td>
                    <td>{request.user.name}</td>
                    <td>{request.device?.nickname || request.device?.platform || "-"}</td>
                    <td>{request.partnerEmail}</td>
                    <td>{formatDateTime(request.createdAt)}</td>
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
