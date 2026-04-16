import { AdminShell } from "@/components/admin/AdminShell";
import { ModuleCard } from "@/components/admin/ModuleCard";
import { CopyButton } from "@/components/forms/CopyButton";
import { requirePermission } from "@/features/auth/auth.service";
import { updateCompanySettingsAction, updatePaymentSplitRulesAction } from "@/features/settings/company-settings.actions";
import { getCompanySettings } from "@/features/settings/company-settings.service";
import { getPaymentHealth } from "@/features/settings/payment-health.service";
import { buildSplitRulesPreview, listPaymentSplitRules } from "@/features/settings/split-settings.service";
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
  const params = searchParams ? await searchParams : {};
  const error = typeof params.error === "string" ? params.error : null;
  const saved = params.saved === "1";
  const [health, companySettings, splitRules] = await Promise.all([
    getPaymentHealth(),
    getCompanySettings(),
    listPaymentSplitRules()
  ]);
  const splitRows = Array.from({ length: 6 }).map((_, index) => splitRules[index] ?? null);
  const splitPreview = buildSplitRulesPreview(splitRules);

  return (
    <AdminShell
      title="Configuracoes"
      description="Dados centrais da empresa e parametros padrao da operacao TCR Ingressos."
    >
      <section className="grid cardsGrid">
        <ModuleCard title="Empresa unica" status="Preparado">
          A tabela de configuracoes guarda os dados da TCR Ingressos, moeda padrao e taxa padrao da
          plataforma.
        </ModuleCard>
        <ModuleCard title="Usuarios internos" status="Preparado">
          Admins internos possuem papel, email unico, senha criptografada e status ativo/inativo.
        </ModuleCard>
        <ModuleCard title="E-mail transacional" status="Pronto">
          Resend: {health.email.resendConfigured ? "configurado" : "nao configurado"}. Remetente:
          {" "}{health.email.from}.
        </ModuleCard>
        <ModuleCard title="Seguranca de producao" status={health.security.productionCronProtected ? "Pronto" : "Preparado"}>
          Sessao: {health.security.authSecretConfigured ? "AUTH_SECRET configurado" : "AUTH_SECRET pendente"}.
          {" "}Rotina: {health.security.cronSecretConfigured ? "CRON_SECRET configurado" : "CRON_SECRET pendente"}.
        </ModuleCard>
      </section>

      <section className="sectionHeader">
        <div>
          <h2>Dados da empresa</h2>
          <p className="muted">Informacoes centrais da operacao propria da TCR Ingressos.</p>
        </div>
      </section>

      <form action={updateCompanySettingsAction} className="card form wideForm">
        {error ? <div className="errorBox">{error}</div> : null}
        {saved ? <div className="successBox">Configuracoes salvas com sucesso.</div> : null}
        {params.splitSaved === "1" ? <div className="successBox">Regras de split salvas com sucesso.</div> : null}
        <div className="grid twoColumns">
          <label className="field">
            <span>Razao social</span>
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
            <span>Moeda padrao</span>
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
          <span>Taxa padrao da plataforma (%)</span>
          <input
            name="platformFeePercent"
            type="text"
            inputMode="decimal"
            defaultValue={percentFromBps(companySettings.platformFeeBps)}
            required
          />
          <small>Referencia administrativa. As taxas efetivas continuam configuradas por lote/ingresso.</small>
        </label>
        <div className="formActions">
          <button className="button" type="submit">
            Salvar configuracoes
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
            <span className="muted">O valor restante fica na conta principal da TCR que criou a cobranca.</span>
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
            <h3>Previa do split</h3>
            <p className="muted">
              Simulacao com pedido de {formatCurrency(splitPreview.orderAmountInCents)} e {splitPreview.ticketQuantity} ingressos.
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
          <p className="muted">Conferencia rapida da integracao ativa, webhooks e ambiente.</p>
        </div>
      </section>

      <section className="card settingsPanel">
        <div className="settingsGrid">
          <div>
            <span>Provedor ativo</span>
            <strong>{health.provider}</strong>
          </div>
          <div>
            <span>URL publica configurada</span>
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
              Persistencia: {health.uploads.provider !== "LOCAL" || health.uploads.localPersistent ? "confirmada" : "confirmar no deploy"}
            </p>
          </div>
        </div>

        <div className="settingsStatusList">
          <div className="settingsStatusItem">
            <span className={`status ${health.asaas.enabled ? "published" : "draft"}`}>Asaas</span>
            <p>
              Chave API: {health.asaas.apiKeyConfigured ? health.asaas.apiKeyMasked : "nao configurada"}
              <br />
              Tipo padrao: {health.asaas.billingType}
              <br />
              Webhook token: {health.asaas.webhookTokenConfigured ? "configurado" : "nao configurado"}
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
              Access token: {health.mercadoPago.accessTokenConfigured ? "configurado" : "nao configurado"}
              <br />
              Webhook secret:{" "}
              {health.mercadoPago.webhookSecretConfigured ? "configurado" : "nao configurado"}
            </p>
          </div>
        </div>

        <div className="settingsWebhookBox">
          <h3>Webhook Asaas esperado</h3>
          <p className="breakText">{health.asaas.webhookUrl}</p>
          <p className="muted">
            Token por query/header: {health.asaas.webhookTokenConfigured ? "configurado" : "nao configurado"}
          </p>
          <CopyButton className="secondaryButton smallButton" label="Copiar webhook" copiedLabel="Copiado" value={health.asaas.webhookUrl} />
        </div>

        <div className="settingsWebhookBox">
          <h3>Rotina de expiracao de pedidos</h3>
          <p className="breakText">{health.appUrl}/api/maintenance/expire-orders</p>
          <p className="muted">
            Ambiente: {health.security.nodeEnv}. Token CRON:{" "}
            {health.security.cronSecretConfigured ? "configurado" : "nao configurado"}.
          </p>
          <CopyButton
            className="secondaryButton smallButton"
            label="Copiar rota cron"
            copiedLabel="Copiado"
            value={`${health.appUrl}/api/maintenance/expire-orders`}
          />
        </div>

        <div className="settingsWebhookBox">
          <h3>Checklist rapido de deploy</h3>
          <ul className="settingsChecklist">
            <li className={health.security.appUrlIsLocal ? "isBlocked" : "isReady"}>
              Dominio publico: {health.security.appUrlIsLocal ? "ainda esta local" : "configurado"}
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
              {health.recentPayments.map((item) => (
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
