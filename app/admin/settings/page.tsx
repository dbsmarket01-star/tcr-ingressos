import { AdminShell } from "@/components/admin/AdminShell";
import { ModuleCard } from "@/components/admin/ModuleCard";
import { CopyButton } from "@/components/forms/CopyButton";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { requirePermission } from "@/features/auth/auth.service";
import { updateProtectionPolicyAction } from "@/features/security-center/protection-policy.actions";
import { getOrCreateDefaultProtectionPolicy, listProtectionSources } from "@/features/security-center/protection-policy.service";
import {
  updateCompanySettingsAction,
  updateOrganizationLogoAction,
  updatePaymentSplitRulesAction
} from "@/features/settings/company-settings.actions";
import { getCompanySettings } from "@/features/settings/company-settings.service";
import { getPaymentHealth } from "@/features/settings/payment-health.service";
import { buildSplitRulesPreview, listPaymentSplitRules } from "@/features/settings/split-settings.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function percentFromBps(value: number) {
  return (value / 100).toString();
}

function moneyFromCents(value?: number | null) {
  return value ? (value / 100).toString() : "";
}

function splitValueForRule(rule?: Awaited<ReturnType<typeof listPaymentSplitRules>>[number]) {
  if (!rule) {
    return "";
  }

  if (rule.type === "PERCENTAGE") {
    return rule.percentageBps ? percentFromBps(rule.percentageBps) : "";
  }

  return moneyFromCents(rule.fixedValueInCents);
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  await requirePermission("SETTINGS");
  const organizationContext = await getCurrentOrganizationContext();
  const params = searchParams ? await searchParams : {};
  const error = typeof params.error === "string" ? params.error : null;
  const saved = params.saved === "1";
  const [health, companySettings, splitRules, protectionPolicy, protectionSources] = await Promise.all([
    getPaymentHealth(),
    getCompanySettings(),
    listPaymentSplitRules(),
    getOrCreateDefaultProtectionPolicy(),
    listProtectionSources()
  ]);
  const splitRows = Array.from({ length: 6 }).map((_, index) => splitRules[index] ?? null);
  const splitPreview = buildSplitRulesPreview(splitRules);

  return (
    <AdminShell
      title="Configurações"
      description={`Dados centrais da empresa e parâmetros padrão da operação ${organizationContext.brandName}.`}
    >
      <section className="grid cardsGrid">
        <ModuleCard title="Empresa única" status="Preparado">
          A tabela de configurações guarda os dados da {organizationContext.brandName}, moeda padrão e taxa padrão da
          operação.
        </ModuleCard>
        <ModuleCard title="Usuários internos" status="Preparado">
          Admins internos possuem papel, e-mail único, senha criptografada e status ativo/inativo.
        </ModuleCard>
        <ModuleCard title="E-mail transacional" status="Pronto">
          Resend: {health.email.resendConfigured ? "configurado" : "não configurado"}. Remetente:
          {" "}{health.email.from}.
        </ModuleCard>
        <ModuleCard title="Segurança de produção" status={health.security.productionCronProtected ? "Pronto" : "Preparado"}>
          Sessão: {health.security.authSecretConfigured ? "AUTH_SECRET configurado" : "AUTH_SECRET pendente"}.
          {" "}Rotina: {health.security.cronSecretConfigured ? "CRON_SECRET configurado" : "CRON_SECRET pendente"}.
        </ModuleCard>
      </section>

      <section className="sectionHeader">
        <div>
          <h2>Dados da empresa</h2>
          <p className="muted">Informações centrais da operação {organizationContext.brandName}.</p>
        </div>
      </section>

      <form action={updateCompanySettingsAction} className="card form wideForm">
        {error ? <div className="errorBox">{error}</div> : null}
        {saved ? <div className="successBox">Configurações salvas com sucesso.</div> : null}
        {params.brandingSaved === "1" ? <div className="successBox">Logo da operação salva com sucesso.</div> : null}
        {params.splitSaved === "1" ? <div className="successBox">Regras de split salvas com sucesso.</div> : null}
        {params.policySaved === "1" ? <div className="successBox">Politica de protecao salva com sucesso.</div> : null}
        <div className="grid twoColumns">
          <label className="field">
            <span>Razão social</span>
            <input name="companyName" defaultValue={companySettings.companyName} required />
          </label>
          <label className="field">
            <span>Nome fantasia</span>
            <input name="tradeName" defaultValue={companySettings.tradeName} required />
          </label>
        </div>
        <div className="grid twoColumns">
          <label className="field">
            <span>Documento</span>
            <input name="document" defaultValue={companySettings.document} required />
          </label>
          <label className="field">
            <span>Moeda padrão</span>
            <input name="defaultCurrency" maxLength={3} defaultValue={companySettings.defaultCurrency} required />
          </label>
        </div>
        <div className="grid twoColumns">
          <label className="field">
            <span>E-mail de suporte</span>
            <input name="supportEmail" type="email" defaultValue={companySettings.supportEmail} required />
          </label>
          <label className="field">
            <span>Telefone de suporte</span>
            <input name="supportPhone" defaultValue={companySettings.supportPhone ?? ""} />
          </label>
        </div>
        <label className="field">
          <span>Taxa padrão da plataforma (%)</span>
          <input
            name="platformFeePercent"
            type="text"
            inputMode="decimal"
            defaultValue={percentFromBps(companySettings.platformFeeBps)}
            required
          />
          <small>Referência administrativa. As taxas efetivas continuam configuradas por lote/ingresso.</small>
        </label>
        <div className="grid twoColumns">
          <label className="field">
            <span>Reserva interna do pedido (minutos)</span>
            <input
              name="orderReservationMinutes"
              type="number"
              min="15"
              max="1440"
              defaultValue={companySettings.orderReservationMinutes}
              required
            />
            <small>Uso interno. Define por quanto tempo o pedido segura estoque antes de expirar.</small>
          </label>
          <label className="field">
            <span>Cartão pendente (minutos)</span>
            <input
              name="cardPendingReservationMinutes"
              type="number"
              min="5"
              max="240"
              defaultValue={companySettings.cardPendingReservationMinutes}
              required
            />
            <small>Preparado para tratamentos futuros de cartão pendente ou análise manual.</small>
          </label>
        </div>
        <div className="formActions">
          <button className="button" type="submit">
            Salvar configurações
          </button>
        </div>
      </form>

      <section className="sectionHeader">
        <div>
          <h2>Marca da operação</h2>
          <p className="muted">Use a logo oficial da TCR para substituir o selo textual no topo do sistema.</p>
        </div>
      </section>

      <form action={updateOrganizationLogoAction} className="card form wideForm">
        <div className="settingsBrandPanel">
          <div className="settingsBrandPreview">
            <span className="fieldLabel">Prévia atual</span>
            {organizationContext.brandLogoUrl ? (
              <div className="settingsBrandPreviewBox">
                <img alt={organizationContext.brandName} className="settingsBrandPreviewImage" src={organizationContext.brandLogoUrl} />
              </div>
            ) : (
              <div className="settingsBrandPreviewFallback">
                <span className="brandMark">{organizationContext.brandMark}</span>
                <strong>{organizationContext.brandName}</strong>
              </div>
            )}
          </div>
          <div className="settingsBrandFields">
            <ImageUploadField
              name="organizationLogoFile"
              label="Logo da operação"
              currentImageUrl={organizationContext.brandLogoUrl}
              emptyText="Envie a logo oficial da TCR"
              recommendedSize="PNG ou WEBP com fundo transparente"
              usageHint="Ela aparece no topo do admin e nas páginas públicas da operação."
              aspect="share"
            />
            <label className="field">
              <span>Ou informe uma URL da logo</span>
              <input
                name="organizationLogoUrl"
                defaultValue={organizationContext.brandLogoUrl ?? ""}
                placeholder="https://cdn.sualogo.com/logo.png"
              />
              <small>Se enviar um arquivo acima, ele tem prioridade sobre esta URL.</small>
            </label>
          </div>
        </div>
        <div className="formActions">
          <button className="button" type="submit">
            Salvar logo da operação
          </button>
        </div>
      </form>

      <section className="sectionHeader">
        <div>
          <h2>Politica de protecao</h2>
          <p className="muted">Define as regras remotas que Android e iOS devem sincronizar para bloquear conteudo adulto e reagir a bypass.</p>
        </div>
      </section>

      <form action={updateProtectionPolicyAction} className="card form wideForm">
        <div className="grid twoColumns">
          <label className="field">
            <span>Nome da politica</span>
            <input name="policyName" defaultValue={protectionPolicy.name} required />
          </label>
          <label className="field">
            <span>Foco</span>
            <input value={`Versao ${protectionPolicy.version} · pornografia em prioridade`} disabled />
          </label>
        </div>
        <label className="field">
          <span>Descricao</span>
          <textarea name="policyDescription" defaultValue={protectionPolicy.description ?? ""} rows={3} />
        </label>
        <div className="grid twoColumns">
          <label className="field checkboxField">
            <input name="targetPornographyOnly" type="checkbox" defaultChecked={protectionPolicy.targetPornographyOnly} />
            <span>Priorizar pornografia como categoria principal</span>
          </label>
          <label className="field checkboxField">
            <input name="pinRequiredToDisable" type="checkbox" defaultChecked={protectionPolicy.pinRequiredToDisable} />
            <span>Exigir PIN para desativar protecao</span>
          </label>
          <label className="field checkboxField">
            <input name="enforceAndroidVpn" type="checkbox" defaultChecked={protectionPolicy.enforceAndroidVpn} />
            <span>Obrigar VPN local no Android</span>
          </label>
          <label className="field checkboxField">
            <input name="enforceIosDnsProxy" type="checkbox" defaultChecked={protectionPolicy.enforceIosDnsProxy} />
            <span>Exigir DNS proxy no iOS</span>
          </label>
          <label className="field checkboxField">
            <input name="blockUnknownDnsChanges" type="checkbox" defaultChecked={protectionPolicy.blockUnknownDnsChanges} />
            <span>Tratar troca de DNS como risco</span>
          </label>
          <label className="field checkboxField">
            <input name="detectExternalVpn" type="checkbox" defaultChecked={protectionPolicy.detectExternalVpn} />
            <span>Detectar VPN externa</span>
          </label>
          <label className="field checkboxField">
            <input name="detectProxy" type="checkbox" defaultChecked={protectionPolicy.detectProxy} />
            <span>Detectar proxy</span>
          </label>
          <label className="field checkboxField">
            <input name="detectDeveloperMode" type="checkbox" defaultChecked={protectionPolicy.detectDeveloperMode} />
            <span>Detectar modo desenvolvedor</span>
          </label>
        </div>
        <div className="grid twoColumns">
          <label className="field">
            <span>Heartbeat esperado (minutos)</span>
            <input
              name="heartbeatIntervalMinutes"
              type="number"
              min="1"
              max="120"
              defaultValue={protectionPolicy.heartbeatIntervalMinutes}
              required
            />
          </label>
          <label className="field">
            <span>Janela de tolerancia sem heartbeat (minutos)</span>
            <input
              name="staleHeartbeatGraceMinutes"
              type="number"
              min="5"
              max="360"
              defaultValue={protectionPolicy.staleHeartbeatGraceMinutes}
              required
            />
          </label>
        </div>
        <div className="settingsWebhookBox">
          <h3>Blocklists sincronizadas</h3>
          {protectionSources.length === 0 ? (
            <p>Nenhuma fonte cadastrada ainda.</p>
          ) : (
            <ul className="launchChecklistList">
              {protectionSources.map((source: any) => (
                <li key={source.id}>
                  <strong>{source.name}</strong> · {source.isEnabled ? "ativa" : "inativa"} · versao {source.version} · {source.entries.length} entrada(s)
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="formActions">
          <button className="button" type="submit">
            Salvar politica
          </button>
        </div>
      </form>

      <section className="sectionHeader">
        <div>
          <h2>Split Asaas</h2>
          <p className="muted">Configure repasses por percentual, valor fixo por pedido ou valor fixo por ingresso vendido.</p>
        </div>
      </section>

      <form action={updatePaymentSplitRulesAction} className="card form wideForm">
        <div className="splitRulesHeader">
          <div>
            <strong>Regras de repasse</strong>
            <span className="muted">O valor restante fica na conta principal da TCR que criou a cobrança.</span>
          </div>
          <span className={`status ${health.asaas.splitEnabled ? "published" : "draft"}`}>
            {health.asaas.splitEnabled ? "Split ligado" : "Split desligado no ambiente"}
          </span>
        </div>
        <div className="splitRulesList">
          {splitRows.map((rule, index) => (
            <div className="splitRuleRow" key={rule?.id ?? index}>
              <label className="field">
                <span>Ativo</span>
                <input name={`splitActive_${index}`} type="checkbox" defaultChecked={rule?.isActive ?? index === 0} />
              </label>
              <label className="field">
                <span>Nome</span>
                <input name={`splitName_${index}`} defaultValue={rule?.name ?? ""} placeholder="Socio / parceiro" />
              </label>
              <label className="field">
                <span>Wallet ID Asaas</span>
                <input name={`splitWalletId_${index}`} defaultValue={rule?.walletId ?? ""} placeholder="wallet_id_do_socio" />
              </label>
              <label className="field">
                <span>Tipo</span>
                <select name={`splitType_${index}`} defaultValue={rule?.type ?? "PERCENTAGE"}>
                  <option value="PERCENTAGE">Porcentagem</option>
                  <option value="FIXED_PER_ORDER">Valor fixo por pedido</option>
                  <option value="FIXED_PER_TICKET">Valor fixo por ingresso vendido</option>
                </select>
              </label>
              <label className="field">
                <span>Valor</span>
                <input
                  name={`splitValue_${index}`}
                  type="text"
                  inputMode="decimal"
                  defaultValue={splitValueForRule(rule ?? undefined)}
                  placeholder="Ex: 10 ou 1,00"
                />
                <small>Use 10 para 10% ou 1,00 para R$ 1 por pedido/ingresso.</small>
              </label>
            </div>
          ))}
        </div>
        <div className="settingsWebhookBox">
          <h3>Como funciona o valor por ingresso</h3>
          <p>
            Se uma regra estiver em R$ 1,00 por ingresso e o pedido tiver 5 ingressos, o sistema envia
            R$ 5,00 de split para aquela carteira no pagamento do Asaas.
          </p>
        </div>
        <div className="splitPreviewBox">
          <div>
            <h3>Prévia do split</h3>
            <p className="muted">
              Simulação com pedido de {formatCurrency(splitPreview.orderAmountInCents)} e {splitPreview.ticketQuantity} ingressos.
            </p>
          </div>
          {splitPreview.rows.length === 0 ? (
            <p className="muted">Nenhuma regra salva ainda.</p>
          ) : (
            <div className="tableScroll">
              <table className="table splitPreviewTable">
                <thead>
                  <tr>
                    <th>Regra</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Repasse estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {splitPreview.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        <br />
                        <span className="muted breakText">{row.walletId}</span>
                      </td>
                      <td>{row.type}</td>
                      <td>{row.isActive ? "Ativo" : "Inativo"}</td>
                      <td>{formatCurrency(row.estimatedAmountInCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="splitPreviewTotals">
            <div>
              <span>Total repassado</span>
              <strong>{formatCurrency(splitPreview.totalInCents)}</strong>
            </div>
            <div>
              <span>Restante TCR</span>
              <strong>{formatCurrency(splitPreview.remainingInCents)}</strong>
            </div>
          </div>
        </div>
        <div className="formActions">
          <button className="button" type="submit">
            Salvar split
          </button>
        </div>
      </form>

      <section className="sectionHeader">
        <div>
          <h2>Pagamentos</h2>
          <p className="muted">Conferência rápida da integração ativa, webhooks e ambiente.</p>
        </div>
      </section>

      <section className="card settingsPanel">
        <div className="settingsGrid">
          <div>
            <span>Provedor ativo</span>
            <strong>{health.provider}</strong>
          </div>
          <div>
            <span>URL pública configurada</span>
            <strong className="breakText">{health.appUrl}</strong>
          </div>
          <div>
            <span>Ambiente Asaas</span>
            <strong>{health.asaas.environment}</strong>
          </div>
          <div>
            <span>Split Asaas</span>
            <strong>
              {health.asaas.splitEnabled
                ? `${health.asaas.splitWalletsConfigured} carteira(s), ${health.asaas.splitRulesConfigured} regra(s)`
                : "Desligado"}
            </strong>
          </div>
          <div>
            <span>Storage de imagens</span>
            <strong>{health.uploads.provider}</strong>
          </div>
        </div>

        <div className="settingsStatusList">
          <div className="settingsStatusItem">
            <span className={`status ${health.database.databaseUrlConfigured ? "published" : "draft"}`}>
              Banco
            </span>
            <p>
              DATABASE_URL: {health.database.databaseUrlConfigured ? "configurado" : "pendente"}
              <br />
              DIRECT_URL: {health.database.directUrlConfigured ? "configurado" : "pendente"}
            </p>
          </div>

          <div className="settingsStatusItem">
            <span className={`status ${health.google.clientIdConfigured && health.google.clientSecretConfigured ? "published" : "draft"}`}>
              Google login
            </span>
            <p>
              Client ID: {health.google.clientIdConfigured ? "configurado" : "pendente"}
              <br />
              Client Secret: {health.google.clientSecretConfigured ? "configurado" : "pendente"}
            </p>
          </div>

          <div className="settingsStatusItem">
            <span className={`status ${health.uploads.provider !== "LOCAL" || health.uploads.localPersistent ? "published" : "draft"}`}>
              Imagens
            </span>
            <p>
              Provedor: {health.uploads.provider}
              <br />
              Limite por imagem: {health.uploads.maxImageMb}MB
              <br />
              Persistência: {health.uploads.provider !== "LOCAL" || health.uploads.localPersistent ? "confirmada" : "confirmar no deploy"}
            </p>
          </div>
        </div>

        <div className="settingsStatusList">
          <div className="settingsStatusItem">
            <span className={`status ${health.asaas.enabled ? "published" : "draft"}`}>Asaas</span>
            <p>
              Chave API: {health.asaas.apiKeyConfigured ? health.asaas.apiKeyMasked : "não configurada"}
              <br />
              Tipo padrão: {health.asaas.billingType}
              <br />
              Webhook token: {health.asaas.webhookTokenConfigured ? "configurado" : "não configurado"}
              <br />
              Split:{" "}
              {health.asaas.splitEnabled
                ? `${health.asaas.splitWalletsConfigured} carteira(s) e ${health.asaas.splitRulesConfigured} regra(s)`
                : "desligado"}
            </p>
          </div>

          <div className="settingsStatusItem">
            <span className={`status ${health.mercadoPago.enabled ? "published" : "draft"}`}>
              Mercado Pago
            </span>
            <p>
              Access token: {health.mercadoPago.accessTokenConfigured ? "configurado" : "não configurado"}
              <br />
              Webhook secret:{" "}
              {health.mercadoPago.webhookSecretConfigured ? "configurado" : "não configurado"}
            </p>
          </div>
        </div>

        <div className="settingsWebhookBox">
          <h3>Webhook Asaas esperado</h3>
          <p className="breakText">{health.asaas.webhookUrl}</p>
          <p className="muted">
            Token por query/header: {health.asaas.webhookTokenConfigured ? "configurado" : "não configurado"}
          </p>
          <CopyButton className="secondaryButton smallButton" label="Copiar webhook" copiedLabel="Copiado" value={health.asaas.webhookUrl} />
        </div>

        <div className="settingsWebhookBox">
          <h3>Rotina de expiração de pedidos</h3>
          <p className="breakText">{health.appUrl}/api/maintenance/expire-orders</p>
          <p className="muted">
            Ambiente: {health.security.nodeEnv}. Token CRON:{" "}
            {health.security.cronSecretConfigured ? "configurado" : "não configurado"}.
          </p>
          <CopyButton
            className="secondaryButton smallButton"
            label="Copiar rota cron"
            copiedLabel="Copiado"
            value={`${health.appUrl}/api/maintenance/expire-orders`}
          />
        </div>

        <div className="settingsWebhookBox">
          <h3>Checklist rápido de deploy</h3>
          <ul className="settingsChecklist">
            <li className={health.security.appUrlIsLocal ? "isBlocked" : "isReady"}>
              Domínio público: {health.security.appUrlIsLocal ? "ainda está local" : "configurado"}
            </li>
            <li className={health.security.authSecretConfigured ? "isReady" : "isBlocked"}>
              AUTH_SECRET: {health.security.authSecretConfigured ? "configurado" : "pendente"}
            </li>
            <li className={health.security.cronSecretConfigured ? "isReady" : "isBlocked"}>
              CRON_SECRET: {health.security.cronSecretConfigured ? "configurado" : "pendente"}
            </li>
            <li className={health.email.resendConfigured ? "isReady" : "isBlocked"}>
              Resend/e-mail: {health.email.resendConfigured ? "configurado" : "pendente"}
            </li>
            <li className={health.asaas.enabled && health.asaas.apiKeyConfigured ? "isReady" : "isBlocked"}>
              Asaas: {health.asaas.enabled && health.asaas.apiKeyConfigured ? "configurado" : "pendente"}
            </li>
            <li className={health.asaas.splitEnabled && health.asaas.splitWalletsConfigured > 0 && health.asaas.splitRulesConfigured > 0 ? "isReady" : "isBlocked"}>
              Split Asaas:{" "}
              {health.asaas.splitEnabled && health.asaas.splitWalletsConfigured > 0 && health.asaas.splitRulesConfigured > 0
                ? "pronto"
                : "pendente"}
            </li>
            <li className={health.uploads.provider !== "LOCAL" || health.uploads.localPersistent ? "isReady" : "isBlocked"}>
              Imagens: {health.uploads.provider !== "LOCAL" || health.uploads.localPersistent ? "storage pronto" : "confirmar storage"}
            </li>
          </ul>
        </div>
      </section>

      <section className="sectionHeader">
        <div>
          <h2>Resumo de pagamentos</h2>
          <p className="muted">Contagem por provedor e status gravada no banco.</p>
        </div>
      </section>

      <section className="card">
        {health.recentPayments.length === 0 ? (
          <div className="empty">Nenhum pagamento registrado ainda.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Provedor</th>
                <th>Status</th>
                <th>Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {health.recentPayments.map((item: any) => (
                <tr key={`${item.provider}-${item.status}`}>
                  <td>{item.provider}</td>
                  <td>{item.status}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
