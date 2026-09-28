import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { sendCrmWhatsAppApprovedTemplate, sendCrmWhatsAppMessage } from "@/features/crm/whatsapp-chat.actions";
import { getCrmWhatsAppConversation, getCrmWhatsAppInbox } from "@/features/crm/whatsapp-chat.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type CrmWhatsAppPageProps = {
  searchParams?: Promise<{
    leadId?: string;
    message?: string;
    orderCode?: string;
    phone?: string;
    search?: string;
    status?: string;
  }>;
};

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    SENT: "Enviada",
    DELIVERED: "Entregue",
    READ: "Lida",
    FAILED: "Falhou",
    RECEIVED: "Recebida"
  };

  return labels[status] || status;
}

function getErrorLabel(errorMessage: string | null) {
  if (errorMessage === "API access blocked.") {
    return "Nao entregue pela Meta: acesso da API bloqueado.";
  }

  if (errorMessage === "WhatsApp Business API nao configurada.") {
    return "Nao entregue: API do WhatsApp nao estava configurada no momento do envio.";
  }

  return errorMessage;
}

function getTemplateLabel(templateName: string | null) {
  if (!templateName) {
    return null;
  }

  if (templateName.startsWith("abandono_carrinho_tcr_botao")) {
    return "Carrinho abandonado";
  }

  if (templateName.startsWith("abandono_carrinho_tcr_followup")) {
    return "Follow-up de carrinho";
  }

  return "Mensagem automática";
}

export default async function CrmWhatsAppPage({ searchParams }: CrmWhatsAppPageProps) {
  const admin = await requirePermission("CRM");
  const params = searchParams ? await searchParams : {};
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const inbox = await getCrmWhatsAppInbox({
    organizationId: admin.organizationId,
    allowedEventIds,
    search: params.search
  });
  const selectedInboxItem =
    params.orderCode || params.leadId || params.phone
      ? null
      : inbox[0] || null;
  const selectedOrderCode = params.orderCode || selectedInboxItem?.orderCode || undefined;
  const selectedPhone = params.phone || selectedInboxItem?.phone || undefined;
  const conversation = await getCrmWhatsAppConversation({
    orderCode: selectedOrderCode,
    leadId: params.leadId,
    phone: selectedPhone,
    organizationId: admin.organizationId,
    allowedEventIds
  });
  const contact = conversation.contact;

  return (
    <AdminShell
      title="WhatsApp interno"
      description="Atendimento comercial conectado a API oficial do WhatsApp."
      headerVariant="minimal"
    >
      <div className="crmWhatsappPage">
        <header className="crmWhatsappHeader">
          <div>
            <span>CRM / WhatsApp</span>
            <h1>Central de conversas</h1>
            <p>Responda compradores e acompanhe retornos das mensagens automáticas.</p>
          </div>
          <Link className="crmSecondaryButton" href="/admin/crm">
            Voltar ao Kanban
          </Link>
        </header>

        {params.status ? (
          <div className={`crmWhatsappFeedback ${params.status === "erro" ? "isError" : "isSuccess"}`}>
            {params.message || (params.status === "erro" ? "Nao foi possivel enviar." : "Mensagem enviada.")}
          </div>
        ) : null}

        <section className="crmWhatsappShell">
          <aside className="crmWhatsappInboxPanel">
            <div className="crmWhatsappInboxTop">
              <div>
                <strong>Conversas</strong>
                <span>{inbox.filter((item) => item.needsReply).length} aguardando resposta</span>
              </div>
              <form action="/admin/crm/whatsapp" method="get">
                <input name="search" placeholder="Buscar conversa" defaultValue={params.search || ""} />
              </form>
            </div>
            <nav className="crmWhatsappInboxList" aria-label="Conversas do WhatsApp">
              {inbox.length === 0 ? <p className="crmWhatsappInboxEmpty">Nenhuma conversa encontrada.</p> : null}
              {inbox.map((item) => {
                const query = new URLSearchParams();
                if (item.orderCode) query.set("orderCode", item.orderCode);
                else query.set("phone", item.phone);
                const isActive =
                  (selectedOrderCode && selectedOrderCode === item.orderCode) ||
                  (!selectedOrderCode && selectedPhone && selectedPhone.replace(/\D/g, "").endsWith(item.key));
                return (
                  <Link
                    className={`crmWhatsappInboxItem ${isActive ? "isActive" : ""}`}
                    href={`/admin/crm/whatsapp?${query.toString()}`}
                    key={item.key}
                  >
                    <span className="crmWhatsappInboxAvatar">{item.name.slice(0, 2).toUpperCase()}</span>
                    <span className="crmWhatsappInboxCopy">
                      <span className="crmWhatsappInboxName">
                        <strong>{item.name}</strong>
                        <time>{formatDateTime(item.latestAt)}</time>
                      </span>
                      <small>{item.eventTitle}</small>
                      <span className="crmWhatsappInboxPreview">
                        {item.lastDirection === "outbound" ? "Você: " : ""}
                        {item.latestMessage}
                      </span>
                    </span>
                    {item.needsReply ? <i title="Aguardando resposta" /> : null}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="crmWhatsappConversation">
            <header className="crmWhatsappConversationHeader">
              <div className="crmWhatsappContactAvatar">{contact?.name?.slice(0, 2).toUpperCase() || "WA"}</div>
              <div>
                <strong>{contact?.name || "Selecione uma conversa"}</strong>
                <span>{contact?.eventTitle || contact?.phone || "Caixa de entrada do WhatsApp"}</span>
              </div>
              {contact ? (
                conversation.canReply ? (
                  <small className="crmWhatsappWindowOpen">Atendimento aberto</small>
                ) : (
                  <small className="crmWhatsappWindowClosed">Fora da janela de 24h</small>
                )
              ) : null}
            </header>
            <div className="crmWhatsappMessages">
              {conversation.hiddenFailureCount > 0 ? (
                <div className="crmWhatsappNotice">
                  {conversation.hiddenFailureCount} tentativa{conversation.hiddenFailureCount === 1 ? "" : "s"} antiga
                  {conversation.hiddenFailureCount === 1 ? "" : "s"} com falha tecnica foram ocultadas desta conversa.
                </div>
              ) : null}

              {conversation.messages.length === 0 ? (
                <div className="crmWhatsappEmpty">
                  {conversation.hiddenFailureCount > 0
                    ? "Nenhuma mensagem entregue ou recebida com este contato ainda."
                    : "Nenhuma mensagem registrada com este contato ainda."}
                </div>
              ) : (
                conversation.messages.map((message) => {
                  const templateLabel = getTemplateLabel(message.templateName);

                  return (
                    <article className={`crmWhatsappBubble ${message.direction === "inbound" ? "isInbound" : "isOutbound"}`} key={message.id}>
                      {templateLabel ? <span className="crmWhatsappTemplate">{templateLabel}</span> : null}
                      <p>{message.content}</p>
                      {message.errorMessage ? <small className="crmWhatsappError">{getErrorLabel(message.errorMessage)}</small> : null}
                      {message.errorDetails ? <small className="crmWhatsappErrorDetails">{message.errorDetails}</small> : null}
                      <footer>
                        <span>{getStatusLabel(message.status)}</span>
                        <time>{formatDateTime(message.createdAt)}</time>
                      </footer>
                    </article>
                  );
                })
              )}
            </div>

            <form action={sendCrmWhatsAppMessage} className="crmWhatsappComposer">
              <input name="orderCode" type="hidden" value={selectedOrderCode || ""} />
              <input name="leadId" type="hidden" value={params.leadId || ""} />
              <input name="phone" type="hidden" value={selectedPhone || contact?.phone || ""} />
              <textarea
                name="text"
                placeholder={
                  conversation.canReply
                    ? "Escreva uma resposta para o cliente"
                    : "Aguardando o cliente responder para abrir a janela de 24h"
                }
                disabled={!conversation.canReply || !contact?.phone}
                rows={3}
              />
              <button className="crmPrimaryButton" type="submit" disabled={!conversation.canReply || !contact?.phone}>
                Enviar
              </button>
            </form>
            {!conversation.canReply && contact?.phone ? (
              <form action={sendCrmWhatsAppApprovedTemplate} className="crmWhatsappTemplateComposer">
                <input name="orderCode" type="hidden" value={selectedOrderCode || ""} />
                <input name="leadId" type="hidden" value={params.leadId || ""} />
                <input name="phone" type="hidden" value={selectedPhone || contact.phone || ""} />
                <p>Para iniciar conversa fora da janela de 24h, envie um template aprovado pela Meta.</p>
                <button className="crmSecondaryButton" type="submit" disabled={!contact.orderCode}>
                  Enviar template aprovado
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
