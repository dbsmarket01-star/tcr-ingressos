import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { sendCrmWhatsAppApprovedTemplate, setCrmWhatsAppAiMode, setCrmWhatsAppFollowUp } from "@/features/crm/whatsapp-chat.actions";
import { getCrmWhatsAppConversation, getCrmWhatsAppInbox } from "@/features/crm/whatsapp-chat.service";
import { getWhatsAppAiConversationState } from "@/features/ai/whatsapp-support-ai.service";
import { WhatsAppComposer } from "./WhatsAppComposer";
import { WhatsAppNotificationWatcher } from "./WhatsAppNotificationWatcher";
import { WhatsAppReadMarker } from "./WhatsAppReadMarker";
import { WhatsAppUnreadBadge } from "./WhatsAppUnreadBadge";
import { WhatsAppMessageScroller } from "./WhatsAppMessageScroller";

export const dynamic = "force-dynamic";

type CrmWhatsAppPageProps = { searchParams?: Promise<{ leadId?: string; limit?: string; message?: string; orderCode?: string; phone?: string; search?: string; status?: string }> };
type IconName = "search" | "filter" | "bell" | "dots" | "star" | "clock" | "kanban" | "plus" | "smile" | "clip" | "send" | "check";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>, filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>, dots: <><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    kanban: <><path d="M4 5h5v14H4zM15 5h5v9h-5z"/></>, plus: <path d="M12 5v14M5 12h14"/>, smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></>,
    clip: <path d="m9 13 5.8-5.8a3 3 0 1 1 4.2 4.2l-7.5 7.5a5 5 0 0 1-7.1-7.1l7.1-7.1"/>, send: <path d="m3 11 18-8-8 18-2-8-8-2Zm8 2 4-4"/>, check: <path d="m7 12 3 3 7-7"/>
  };
  return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const initials = (name?: string | null) => String(name || "WA").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const CRM_TIME_ZONE = "America/Sao_Paulo";
const timeLabel = (value: Date) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: CRM_TIME_ZONE }).format(value);
function dayLabel(value: Date) {
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: CRM_TIME_ZONE });
  const dayKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: CRM_TIME_ZONE });
  const text = formatter.format(value);
  return dayKey.format(value) === dayKey.format(new Date()) ? `Hoje • ${text}` : text;
}
function inboxDayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: CRM_TIME_ZONE }).format(value);
}
function inboxDayLabel(value: Date) {
  const key = inboxDayKey(value);
  const today = inboxDayKey(new Date());
  const yesterday = inboxDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (key === today) return "Hoje";
  if (key === yesterday) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: CRM_TIME_ZONE }).format(value);
}
function inboxStatusLabel(item: { hasUnread: boolean; aiMode?: string; followUp: boolean; isClosed: boolean; abandonedWithoutReturn: boolean }) {
  if (item.aiMode === "HANDOFF") return "Atendente solicitado";
  if (item.isClosed) return "Compra confirmada";
  if (item.followUp) return "Follow-up";
  if (item.abandonedWithoutReturn) return "Carrinho sem retorno";
  if (item.hasUnread) return "Nova mensagem";
  return "Conversa pelo WhatsApp";
}
function getErrorLabel(errorMessage: string | null) { if (errorMessage === "API access blocked.") return "Não entregue pela Meta: acesso da API bloqueado."; if (errorMessage === "WhatsApp Business API nao configurada.") return "Não entregue: API do WhatsApp não estava configurada no momento do envio."; return errorMessage; }
function getTemplateLabel(templateName: string | null) { if (!templateName) return null; if (templateName.startsWith("abandono_carrinho_tcr_botao")) return "Carrinho abandonado"; if (templateName.startsWith("abandono_carrinho_tcr_followup")) return "Follow-up de carrinho"; return "Mensagem automática"; }
function MessageMedia({ media }: { media: { kind: string; url: string | null; fileName: string | null; mimeType: string | null } | null }) {
  if (!media) return null;
  if (!media.url) return <span className="crmWhatsappMediaUnavailable">Arquivo recebido, mas a mídia já não estava disponível para download.</span>;
  if (media.kind === "image" || media.kind === "sticker") return <a className="crmWhatsappMedia" href={media.url} rel="noreferrer" target="_blank"><img alt={media.kind === "sticker" ? "Figurinha recebida" : "Imagem recebida"} loading="lazy" src={media.url}/></a>;
  if (media.kind === "audio") return <audio className="crmWhatsappMediaAudio" controls preload="metadata" src={media.url}>Seu navegador não reproduz este áudio.</audio>;
  if (media.kind === "video") return <video className="crmWhatsappMediaVideo" controls playsInline preload="metadata" src={media.url}>Seu navegador não reproduz este vídeo.</video>;
  return <a className="crmWhatsappMediaFile" download={media.fileName || undefined} href={media.url} rel="noreferrer" target="_blank"><Icon name="clip"/><span><strong>{media.fileName || "Abrir documento"}</strong><small>{media.mimeType || "Arquivo recebido"}</small></span></a>;
}

export default async function CrmWhatsAppPage({ searchParams }: CrmWhatsAppPageProps) {
  const admin = await requirePermission("CRM");
  const params = searchParams ? await searchParams : {};
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const inboxPromise = getCrmWhatsAppInbox({ organizationId: admin.organizationId, allowedEventIds, search: params.search });
  const hasExplicitSelection = Boolean(params.orderCode || params.leadId || params.phone);
  const selectedConversationPromise = hasExplicitSelection
    ? getCrmWhatsAppConversation({ orderCode: params.orderCode, leadId: params.leadId, phone: params.phone, organizationId: admin.organizationId, allowedEventIds })
    : null;
  const rawInbox = await inboxPromise;
  const activeStatus = ["unread", "human", "followup", "closed", "abandoned"].includes(params.status || "") ? params.status! : "all";
  const counters = {
    all: rawInbox.length,
    unread: rawInbox.filter((item) => item.unreadQueue).length,
    human: rawInbox.filter((item) => item.aiMode === "HANDOFF").length,
    followup: rawInbox.filter((item) => item.followUp).length,
    closed: rawInbox.filter((item) => item.isClosed).length,
    abandoned: rawInbox.filter((item) => item.abandonedWithoutReturn).length
  };
  const visualUnreadCount = rawInbox.filter((item) => item.hasUnread).length;
  const inbox = rawInbox.filter((item) =>
    activeStatus === "unread"
      ? item.unreadQueue
      : activeStatus === "human"
        ? item.aiMode === "HANDOFF"
        : activeStatus === "followup"
          ? item.followUp
          : activeStatus === "closed"
            ? item.isClosed
            : activeStatus === "abandoned"
              ? item.abandonedWithoutReturn
              : true
  );
  const requestedLimit = Number(params.limit || 120);
  const displayLimit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 60), 600) : 120;
  const visibleInbox = inbox.slice(0, displayLimit);
  const latestInbound = rawInbox
    .filter((item) => item.latestInboundId && item.latestInboundAt)
    .sort((left, right) => right.latestInboundAt!.getTime() - left.latestInboundAt!.getTime())[0];
  const selectedInboxItem = params.orderCode || params.leadId || params.phone ? null : inbox[0] || rawInbox[0] || null;
  const selectedOrderCode = params.orderCode || selectedInboxItem?.orderCode || undefined;
  const selectedPhone = params.phone || selectedInboxItem?.phone || undefined;
  const conversation = selectedConversationPromise
    ? await selectedConversationPromise
    : await getCrmWhatsAppConversation({ orderCode: selectedOrderCode, leadId: params.leadId, phone: selectedPhone, organizationId: admin.organizationId, allowedEventIds });
  const contact = conversation.contact;
  const aiState = contact?.phone
    ? await getWhatsAppAiConversationState(admin.organizationId, contact.phone)
    : { mode: "DISABLED" as const, reason: "Selecione uma conversa." };
  const eventTags = contact?.eventTitle ? contact.eventTitle.split(" em ") : [];
  let lastDay = "";
  let lastInboxDay = "";
  const statusHref = (status: string) => { const query = new URLSearchParams(); if (params.search) query.set("search", params.search); if (status !== "all") query.set("status", status); return `/admin/crm/whatsapp${query.size ? `?${query}` : ""}`; };

  return <AdminShell title="WhatsApp interno" description="Atendimento comercial conectado à API oficial do WhatsApp." headerVariant="minimal">
    <div className="crmWhatsappPage">
      <header className="crmWhatsappHeader">
        <div className="crmWhatsappHeading"><span className="crmWhatsappBreadcrumb">CRM / <strong>WhatsApp</strong></span><h1>Central de conversas</h1><p>Responda compradores e acompanhe retornos das mensagens automáticas.</p></div>
        <div className="crmWhatsappHeaderTools"><form action="/admin/crm/whatsapp" className="crmWhatsappGlobalSearch" method="get"><Icon name="search"/><input name="search" placeholder="Buscar conversas, contatos ou pedidos..." defaultValue={params.search || ""}/><kbd>⌘ K</kbd></form><WhatsAppNotificationWatcher latestInboundId={latestInbound?.latestInboundId || null} unreadCount={visualUnreadCount}/><span className="crmWhatsappUser"><i>{initials(admin.name)}</i><span><strong>{admin.name}</strong><small>{admin.role}</small></span></span></div>
      </header>

      <nav className="crmWhatsappStatusTabs" aria-label="Filtrar conversas por status">{[["all", "Todos", counters.all], ["unread", "Não lidos", counters.unread], ["human", "Atendimento humano", counters.human], ["followup", "Em atendimento / Follow-up", counters.followup], ["closed", "Fechados", counters.closed], ["abandoned", "Carrinho abandonado sem retorno", counters.abandoned]].map(([key, label, count]) => <Link className={`${activeStatus === key ? "isActive" : ""} ${key === "human" ? "isHuman" : ""}`.trim()} href={statusHref(String(key))} key={String(key)} prefetch={false}>{label}<b>{count}</b></Link>)}</nav>
      {params.status === "erro" || params.status === "ok" ? <div className={`crmWhatsappFeedback ${params.status === "erro" ? "isError" : "isSuccess"}`}>{params.message || "Mensagem enviada."}</div> : null}

      <section className="crmWhatsappShell">
        <aside className="crmWhatsappInboxPanel">
          <form action="/admin/crm/whatsapp" className="crmWhatsappInboxSearch" method="get">{activeStatus !== "all" ? <input name="status" type="hidden" value={activeStatus}/> : null}<label><Icon name="search"/><input name="search" placeholder="Buscar conversa..." defaultValue={params.search || ""}/></label><button aria-label="Aplicar busca" type="submit"><Icon name="filter"/></button></form>
          <nav className="crmWhatsappInboxList" aria-label="Conversas do WhatsApp">{inbox.length === 0 ? <p className="crmWhatsappInboxEmpty">Nenhuma conversa encontrada.</p> : null}{visibleInbox.map((item) => {
            const query = new URLSearchParams(); if (item.orderCode) query.set("orderCode", item.orderCode); else query.set("phone", item.phone); if (params.search) query.set("search", params.search); if (activeStatus !== "all") query.set("status", activeStatus);
            const isActive = (selectedOrderCode && selectedOrderCode === item.orderCode) || (!selectedOrderCode && selectedPhone && selectedPhone.replace(/\D/g, "").endsWith(item.key)); const tags = item.eventTitle.split(" em ");
            const currentInboxDay = inboxDayKey(item.latestAt); const showInboxDay = currentInboxDay !== lastInboxDay; lastInboxDay = currentInboxDay;
            return <div key={item.key}>{showInboxDay ? <div style={{ padding: "9px 14px 5px", color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>{inboxDayLabel(item.latestAt)}</div> : null}<div className={`crmWhatsappInboxItem ${isActive ? "isActive" : ""}`}><Link className="crmWhatsappInboxMainLink" href={`/admin/crm/whatsapp?${query}`} prefetch={false} scroll={false}><span className="crmWhatsappInboxAvatar">{initials(item.name)}</span><span className="crmWhatsappInboxCopy"><span className="crmWhatsappInboxName"><strong>{item.name}</strong><time>{timeLabel(item.latestAt)}</time></span><span className="crmWhatsappInboxPreview">{item.lastDirection === "outbound" ? "Você: " : ""}{item.latestMessage}</span><span className="crmWhatsappInboxTags"><small>{inboxStatusLabel(item)}</small><small>{tags[0]}</small>{tags[1] ? <small>{tags[1]}</small> : null}</span></span>{item.hasUnread ? <WhatsAppUnreadBadge phone={item.phone}/> : null}</Link><details className="crmWhatsappInboxMenu"><summary aria-label={`Opções de ${item.name}`}>⋮</summary><form action={setCrmWhatsAppFollowUp}><input name="phone" type="hidden" value={item.phone}/><input name="enabled" type="hidden" value={item.followUp ? "false" : "true"}/><button type="submit">{item.followUp ? "Remover de Em atendimento / Follow-up" : "Mover para Em atendimento / Follow-up"}</button></form></details></div></div>;
          })}{visibleInbox.length < inbox.length ? <Link className="crmWhatsappInboxEmpty" href={statusHref(activeStatus) + `${statusHref(activeStatus).includes("?") ? "&" : "?"}limit=${Math.min(displayLimit + 120, 600)}`} prefetch={false} scroll={false}>Carregar mais conversas ({inbox.length - visibleInbox.length} restantes)</Link> : null}</nav>
        </aside>

        <div className="crmWhatsappConversation">
          <WhatsAppMessageScroller conversationKey={`${contact?.phone || "empty"}:${conversation.messages.at(-1)?.id || "none"}`}/>
          {contact?.phone ? <WhatsAppReadMarker phone={contact.phone} messageId={[...conversation.messages].reverse().find((message) => message.direction === "inbound")?.id || null}/> : null}
          <header className="crmWhatsappConversationHeader"><div className="crmWhatsappContactIdentity"><span className="crmWhatsappContactAvatar">{initials(contact?.name)}</span><span><strong>{contact?.name || "Selecione uma conversa"}</strong><small>{contact?.phone || "Caixa de entrada do WhatsApp"}</small></span></div><div className="crmWhatsappContactTags">{eventTags[0] ? <span>{eventTags[0]}</span> : null}{eventTags[1] ? <span>{eventTags[1]}</span> : null}{contact ? <span className="isBuyer">• Comprador</span> : null}</div><div className="crmWhatsappConversationActions"><span className="crmWhatsappIconOnly" title="Mais opções"><Icon name="dots"/></span><span className="crmWhatsappIconOnly" title="Favoritos"><Icon name="star"/></span><span className="crmWhatsappIconOnly" title="Histórico"><Icon name="clock"/></span>{contact ? <Link href={contact.orderCode ? `/admin/crm?search=${encodeURIComponent(contact.orderCode)}` : "/admin/crm"}><Icon name="kanban"/>Ver no Kanban</Link> : null}{contact ? <form action={setCrmWhatsAppAiMode}><input name="orderCode" type="hidden" value={selectedOrderCode || ""}/><input name="leadId" type="hidden" value={params.leadId || ""}/><input name="phone" type="hidden" value={selectedPhone || contact.phone || ""}/><input name="mode" type="hidden" value={aiState.mode === "ACTIVE" ? "PAUSED" : "ACTIVE"}/><button title={aiState.reason} type="submit" style={{ appearance: "none", background: aiState.mode === "ACTIVE" ? "#ecfdf5" : aiState.mode === "HANDOFF" ? "#fff7ed" : "#fff", border: `1px solid ${aiState.mode === "ACTIVE" ? "#34d399" : aiState.mode === "HANDOFF" ? "#fb923c" : "#cbd5e1"}`, borderRadius: 10, color: aiState.mode === "ACTIVE" ? "#047857" : aiState.mode === "HANDOFF" ? "#c2410c" : "#334155", cursor: "pointer", fontSize: 12, fontWeight: 800, minHeight: 36, padding: "0 12px" }}>{aiState.mode === "ACTIVE" ? "IA atendendo" : aiState.mode === "HANDOFF" ? "Atendente solicitado" : "Ativar IA"}</button></form> : null}<span className={conversation.canReply ? "isOpen" : "isClosed"}>{conversation.canReply ? "Atendimento aberto" : "Fora da janela de 24h"}</span></div></header>
          <div className="crmWhatsappMessages">{conversation.hiddenFailureCount > 0 ? <div className="crmWhatsappNotice">{conversation.hiddenFailureCount} tentativa(s) antiga(s) com falha técnica foram ocultadas.</div> : null}{conversation.messages.length === 0 ? <div className="crmWhatsappEmpty">{conversation.hiddenFailureCount > 0 ? "Nenhuma mensagem entregue ou recebida com este contato ainda." : "Nenhuma mensagem registrada com este contato ainda."}</div> : conversation.messages.map((message) => { const currentDay = dayLabel(message.createdAt); const showDay = currentDay !== lastDay; lastDay = currentDay; const templateLabel = getTemplateLabel(message.templateName); return <div className="crmWhatsappMessageGroup" key={message.id}>{showDay ? <div className="crmWhatsappDateDivider">{currentDay}</div> : null}<article className={`crmWhatsappBubble ${message.direction === "inbound" ? "isInbound" : "isOutbound"}`}>{templateLabel ? <span className="crmWhatsappTemplate">{templateLabel}</span> : null}<MessageMedia media={message.media}/><p>{message.content}</p>{message.errorMessage ? <small className="crmWhatsappError">{getErrorLabel(message.errorMessage)}</small> : null}{message.errorDetails ? <small className="crmWhatsappErrorDetails">{message.errorDetails}</small> : null}<footer><time>{timeLabel(message.createdAt)}</time>{message.direction === "outbound" ? <Icon name="check"/> : null}</footer></article></div>; })}</div>
          <WhatsAppComposer canReply={conversation.canReply} leadId={params.leadId || ""} orderCode={selectedOrderCode || ""} phone={selectedPhone || contact?.phone || ""}/>
          {!conversation.canReply && contact?.phone ? <form action={sendCrmWhatsAppApprovedTemplate} className="crmWhatsappTemplateComposer"><input name="orderCode" type="hidden" value={selectedOrderCode || ""}/><input name="leadId" type="hidden" value={params.leadId || ""}/><input name="phone" type="hidden" value={selectedPhone || contact.phone || ""}/><p>Fora da janela de 24h. Use um template aprovado para iniciar a conversa.</p><button className="crmSecondaryButton" type="submit" disabled={!contact.orderCode}>Enviar template aprovado</button></form> : null}
        </div>
      </section>
    </div>
  </AdminShell>;
}
