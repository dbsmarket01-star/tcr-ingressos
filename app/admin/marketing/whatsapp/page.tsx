import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { sendLeadWhatsAppBroadcast } from "@/features/whatsapp/whatsapp.admin.actions";
import { isWhatsAppConfigured } from "@/features/whatsapp/whatsapp.service";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type MarketingWhatsAppPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function envStatus(value?: string) {
  return value?.trim() ? "Configurado" : "Pendente";
}

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function whatsappStatusLabel(status: string) {
  const labels: Record<string, string> = {
    SENT: "Enviado",
    DELIVERED: "Entregue",
    READ: "Lido",
    FAILED: "Falhou",
    RECEIVED: "Recebido"
  };

  return labels[status] || status;
}

function whatsappTypeLabel(type: string) {
  const labels: Record<string, string> = {
    PURCHASE_APPROVED: "Compra aprovada",
    CART_ABANDONMENT: "Carrinho abandonado",
    BULK: "Disparo em massa",
    WEBHOOK: "Webhook Meta"
  };

  return labels[type] || type;
}

export default async function MarketingWhatsAppPage({ searchParams }: MarketingWhatsAppPageProps) {
  const admin = await requirePermission("MARKETING");
  const organizationContext = await getCurrentOrganizationContext();
  const params = searchParams ? await searchParams : {};
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const events = await prisma.event.findMany({
    where: {
      organizationId: admin.organizationId,
      status: {
        not: "DRAFT"
      },
      ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
    },
    orderBy: [{ startsAt: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      startsAt: true,
      city: true,
      state: true,
      _count: {
        select: {
          leads: true,
          orders: true
        }
      }
    }
  });
  const configured = isWhatsAppConfigured();
  const status = getParam(params, "status");
  const message = getParam(params, "message");
  const sent = getParam(params, "sent");
  const failed = getParam(params, "failed");
  const total = getParam(params, "total");
  const webhookUrl = `${organizationContext.publicBaseUrl}/api/webhooks/whatsapp/meta`;
  const recentMessages = await prisma.whatsAppMessageLog.findMany({
    where: {
      organizationId: admin.organizationId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 12
  });
  const messageStatusCounts = await prisma.whatsAppMessageLog.groupBy({
    by: ["status"],
    where: {
      organizationId: admin.organizationId
    },
    _count: {
      _all: true
    }
  });
  const countByStatus = new Map(messageStatusCounts.map((item) => [item.status, item._count._all]));
  const sentOrAccepted =
    (countByStatus.get("SENT") || 0) +
    (countByStatus.get("DELIVERED") || 0) +
    (countByStatus.get("READ") || 0);

  return (
    <AdminShell
      title="Disparos WhatsApp"
      description="Central da API oficial do WhatsApp Business para compra aprovada, carrinho abandonado e campanhas."
    >
      <section className="operationCommandStrip spacedSection" aria-label="Disparos de WhatsApp">
        <article className="operationCommandCard">
          <span className="eyebrow">WhatsApp oficial Meta</span>
          <h2>{configured ? "WhatsApp pronto para disparos transacionais." : "WhatsApp preparado, aguardando credenciais."}</h2>
          <p>
            A automacao usa templates aprovados pela Meta e nunca bloqueia pagamento se o WhatsApp falhar.
          </p>
        </article>
        <div className="operationCommandActions">
          <Link className="secondaryButton smallButton" href="/admin/crm">
            Kanban
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/marketing/email">
            E-mail
          </Link>
        </div>
      </section>

      <section className="grid dashboardGrid commercialSummaryGrid">
        <article className="card metric">
          <span className="muted">API Token</span>
          <strong>{envStatus(process.env.WHATSAPP_API_TOKEN)}</strong>
          <small>WHATSAPP_API_TOKEN</small>
        </article>
        <article className="card metric">
          <span className="muted">Numero Meta</span>
          <strong>{envStatus(process.env.WHATSAPP_PHONE_NUMBER_ID)}</strong>
          <small>WHATSAPP_PHONE_NUMBER_ID</small>
        </article>
        <article className="card metric">
          <span className="muted">Conta Business</span>
          <strong>{envStatus(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID)}</strong>
          <small>WHATSAPP_BUSINESS_ACCOUNT_ID</small>
        </article>
        <article className="card dashboardHeroMetric metric">
          <span className="muted">Templates</span>
          <strong>2</strong>
          <small>compra_aprovada e abandono_carrinho</small>
        </article>
        <article className="card metric">
          <span className="muted">Webhook Meta</span>
          <strong>{envStatus(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)}</strong>
          <small>Token de verificacao</small>
        </article>
      </section>

      <section className="card adminPanelBlock spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Disparos disponiveis</h2>
            <p className="muted">
              Compra aprovada e abandono de carrinho ja ficam no fluxo automatico. Disparo em massa usa a lista de leads com telefone.
            </p>
          </div>
        </div>
        <div className="twoColumnGrid">
          <article className="campaignSummaryCard">
            <span>Compra aprovada</span>
            <strong>Automatico</strong>
            <small>Enviado apos pagamento aprovado, com template compra_aprovada.</small>
          </article>
          <article className="campaignSummaryCard">
            <span>Carrinho abandonado</span>
            <strong>5 min</strong>
            <small>Cron verifica pedidos perto de expirar e envia template abandono_carrinho.</small>
          </article>
        </div>
      </section>

      <section className="card adminPanelBlock spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Status e auditoria</h2>
            <p className="muted">
              Tudo que for enviado pela API oficial fica registrado para conferirmos entrega, leitura ou falha.
            </p>
          </div>
        </div>
        <div className="grid dashboardGrid commercialSummaryGrid">
          <article className="card metric">
            <span className="muted">Enviados</span>
            <strong>{sentOrAccepted}</strong>
            <small>Enviados, entregues ou lidos</small>
          </article>
          <article className="card metric">
            <span className="muted">Entregues</span>
            <strong>{countByStatus.get("DELIVERED") || 0}</strong>
            <small>Confirmados pela Meta</small>
          </article>
          <article className="card metric">
            <span className="muted">Lidos</span>
            <strong>{countByStatus.get("READ") || 0}</strong>
            <small>Quando a Meta informar leitura</small>
          </article>
          <article className="card metric">
            <span className="muted">Falhas</span>
            <strong>{countByStatus.get("FAILED") || 0}</strong>
            <small>Bloqueio, template ou telefone invalido</small>
          </article>
        </div>
        <div className="calloutBox">
          <strong>URL para configurar na Meta:</strong>
          <code>{webhookUrl}</code>
          <span className="muted">Use essa URL como callback do webhook do WhatsApp Business.</span>
        </div>
      </section>

      <section className="card adminPanelBlock spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Disparo em massa</h2>
            <p className="muted">
              Envie para leads com telefone usando um template ja aprovado na Meta. O template deve receber nome, evento e link do evento nessa ordem.
            </p>
          </div>
        </div>
        {status ? (
          <div className={`formFeedback ${status === "erro" ? "error" : "success"}`}>
            {status === "erro"
              ? message || "Nao foi possivel enviar a campanha."
              : `Campanha processada: ${sent || 0} enviados, ${failed || 0} falhas, ${total || 0} contatos.`}
          </div>
        ) : null}
        <form action={sendLeadWhatsAppBroadcast} className="formGrid">
          <label>
            <span>Evento</span>
            <select name="eventId" required>
              <option value="">Selecione</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} ({event._count.leads} leads)
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Template Meta</span>
            <input name="templateName" placeholder="Ex.: campanha_evento" required />
          </label>
          <div className="formActions">
            <button className="button" type="submit" disabled={!configured || events.length === 0}>
              Enviar WhatsApp
            </button>
          </div>
        </form>
      </section>

      <section className="card adminPanelBlock spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Eventos para campanhas em massa</h2>
            <p className="muted">A lista abaixo ajuda a escolher o evento antes de disparar campanhas para leads com telefone.</p>
          </div>
        </div>
        {events.length === 0 ? (
          <div className="empty">Nenhum evento disponivel para WhatsApp.</div>
        ) : (
          <div className="tableScroll wideTableScroll adminTableWrap">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Data</th>
                  <th>Local</th>
                  <th>Leads</th>
                  <th>Pedidos</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.title}</strong>
                    </td>
                    <td>{formatDateTime(event.startsAt)}</td>
                    <td>{event.city}, {event.state}</td>
                    <td>{event._count.leads}</td>
                    <td>{event._count.orders}</td>
                    <td>
                      <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}/leads`}>
                        Ver leads
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card adminPanelBlock spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Ultimos disparos</h2>
            <p className="muted">Historico recente para auditoria de compra aprovada, carrinho abandonado e campanhas.</p>
          </div>
        </div>
        {recentMessages.length === 0 ? (
          <div className="empty">Nenhum disparo registrado ainda.</div>
        ) : (
          <div className="tableScroll wideTableScroll adminTableWrap">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Contato</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {recentMessages.map((messageLog) => (
                  <tr key={messageLog.id}>
                    <td>{whatsappTypeLabel(messageLog.type)}</td>
                    <td>
                      <strong>{messageLog.recipientName || "Sem nome"}</strong>
                      <br />
                      <span className="muted">{messageLog.recipientPhone || "Telefone nao informado"}</span>
                    </td>
                    <td>{messageLog.templateName || "-"}</td>
                    <td>{whatsappStatusLabel(messageLog.status)}</td>
                    <td>{formatDateTime(messageLog.createdAt)}</td>
                    <td>{messageLog.errorMessage || messageLog.providerMessageId || "-"}</td>
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
