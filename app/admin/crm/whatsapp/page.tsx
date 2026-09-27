import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { sendCrmWhatsAppApprovedTemplate, sendCrmWhatsAppMessage } from "@/features/crm/whatsapp-chat.actions";
import { getCrmWhatsAppConversation } from "@/features/crm/whatsapp-chat.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type CrmWhatsAppPageProps = {
  searchParams?: Promise<{
    leadId?: string;
    message?: string;
    orderCode?: string;
    phone?: string;
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
  const conversation = await getCrmWhatsAppConversation({
    orderCode: params.orderCode,
    leadId: params.leadId,
    phone: params.phone,
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
            <h1>{contact?.name || "Contato nao encontrado"}</h1>
            <p>{contact?.eventTitle || "Abra a conversa a partir de um card do Kanban."}</p>
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
          <aside className="crmWhatsappContactPanel">
            <div className="crmWhatsappContactAvatar">{contact?.name?.slice(0, 2).toUpperCase() || "WA"}</div>
            <strong>{contact?.name || "Sem contato"}</strong>
            <span>{contact?.phone || "Telefone nao informado"}</span>
            {contact?.email ? <span>{contact.email}</span> : null}
            {contact?.orderCode ? <span>Pedido {contact.orderCode}</span> : null}
            {conversation.canReply ? (
              <small className="crmWhatsappWindowOpen">Janela de atendimento aberta</small>
            ) : (
              <small className="crmWhatsappWindowClosed">
                Para responder com texto livre, o cliente precisa ter enviado mensagem nas ultimas 24h.
              </small>
            )}
          </aside>

          <div className="crmWhatsappConversation">
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
              <input name="orderCode" type="hidden" value={params.orderCode || ""} />
              <input name="leadId" type="hidden" value={params.leadId || ""} />
              <input name="phone" type="hidden" value={params.phone || contact?.phone || ""} />
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
                <input name="orderCode" type="hidden" value={params.orderCode || ""} />
                <input name="leadId" type="hidden" value={params.leadId || ""} />
                <input name="phone" type="hidden" value={params.phone || contact.phone || ""} />
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
