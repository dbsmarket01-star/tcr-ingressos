"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendCrmWhatsAppApprovedTemplate, setCrmWhatsAppAiMode } from "@/features/crm/whatsapp-chat.actions";
import { shouldClearUnread } from "@/features/crm/whatsapp-inbox-classification";
import type { getCrmWhatsAppConversation } from "@/features/crm/whatsapp-chat.service";
import { WhatsAppComposer } from "./WhatsAppComposer";
import { WhatsAppReadMarker } from "./WhatsAppReadMarker";
import { WhatsAppLiveMessages } from "./WhatsAppLiveMessages";
import { WhatsAppMessageScroller } from "./WhatsAppMessageScroller";

type Conversation = Awaited<ReturnType<typeof getCrmWhatsAppConversation>>;
type Selection = { phone?: string; orderCode?: string | null; leadId?: string };
type AiState = { mode: string; reason?: string | null };
const phoneKey = (value: string | null | undefined) => String(value || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
const initials = (name?: string | null) => String(name || "WA").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const timeLabel = (date: Date) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
const dayLabel = (date: Date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date);
const templateLabel = (name: string | null) => !name ? null : name.startsWith("abandono_carrinho_tcr_botao") ? "Carrinho abandonado" : name.startsWith("abandono_carrinho_tcr_followup") ? "Follow-up de carrinho" : "Mensagem automática";

function MessageMedia({ media }: { media: Conversation["messages"][number]["media"] }) {
  if (!media) return null;
  if (!media.url) return <span className="crmWhatsappMediaUnavailable">Arquivo recebido, mas a mídia já não estava disponível para download.</span>;
  if (media.kind === "image" || media.kind === "sticker") return <a className="crmWhatsappMedia" href={media.url} rel="noreferrer" target="_blank"><img alt={media.kind === "sticker" ? "Figurinha recebida" : "Imagem recebida"} loading="lazy" src={media.url}/></a>;
  if (media.kind === "audio") return <audio className="crmWhatsappMediaAudio" controls preload="metadata" src={media.url}>Seu navegador não reproduz este áudio.</audio>;
  if (media.kind === "video") return <video className="crmWhatsappMediaVideo" controls playsInline preload="metadata" src={media.url}>Seu navegador não reproduz este vídeo.</video>;
  return <a className="crmWhatsappMediaFile" download={media.fileName || undefined} href={media.url} rel="noreferrer" target="_blank">📎 {media.fileName || "Abrir documento"}</a>;
}

export function WhatsAppConversationPanel({ initialConversation, initialAiState, initialSelection, initialHasUnread }: {
  initialConversation: Conversation;
  initialAiState: AiState;
  initialSelection: Selection;
  initialHasUnread: boolean;
}) {
  const [conversation, setConversation] = useState(initialConversation);
  const [aiState, setAiState] = useState(initialAiState);
  const [selection, setSelection] = useState(initialSelection);
  const [hasUnread, setHasUnread] = useState(initialHasUnread);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const selectionRef = useRef(initialSelection);
  const latestInboundIdRef = useRef([...initialConversation.messages].reverse().find((message) => message.direction === "inbound")?.id || null);
  const load = useCallback(async (next: Selection, silent = false) => {
    const id = ++requestId.current;
    selectionRef.current = next;
    setSelection(next);
    setError("");
    if (!silent) setLoading(true);
    const query = new URLSearchParams();
    if (next.orderCode) query.set("orderCode", next.orderCode);
    else if (next.phone) query.set("phone", next.phone);
    if (next.leadId) query.set("leadId", next.leadId);
    try {
      const response = await fetch(`/api/admin/crm/whatsapp/conversation?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível abrir a conversa. Tente novamente.");
      const data = await response.json() as { conversation: Conversation; aiState: AiState };
      if (id !== requestId.current) return;
      const resolvedSelection = { ...next, phone: data.conversation.contact?.phone || next.phone };
      selectionRef.current = resolvedSelection;
      latestInboundIdRef.current = [...data.conversation.messages].reverse().find((message) => message.direction === "inbound")?.id || null;
      setSelection(resolvedSelection);
      setConversation({ ...data.conversation, messages: data.conversation.messages.map((message) => ({ ...message, createdAt: new Date(message.createdAt) })) } as Conversation);
      setAiState(data.aiState);
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : "Falha ao abrir a conversa.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const select = (event: Event) => {
      const detail = (event as CustomEvent<Selection & { hasUnread?: boolean }>).detail;
      latestInboundIdRef.current = null;
      setHasUnread(Boolean(detail.hasUnread));
      void load(detail);
    };
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string; id?: string }>).detail;
      if (phoneKey(detail?.phone) !== phoneKey(selectionRef.current.phone)) return;
      latestInboundIdRef.current = detail.id || null;
      void load(selectionRef.current, true);
    };
    const inbound = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string }>).detail;
      if (phoneKey(detail?.phone) !== phoneKey(selectionRef.current.phone)) return;
      setHasUnread(true);
      void load(selectionRef.current, true);
    };
    const read = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string; messageId?: string }>).detail;
      if (phoneKey(detail?.phone) !== phoneKey(selectionRef.current.phone)) return;
      if (shouldClearUnread(latestInboundIdRef.current, detail.messageId)) setHasUnread(false);
    };
    const pop = () => {
      const params = new URL(window.location.href).searchParams;
      const next = { phone: params.get("phone") || undefined, orderCode: params.get("orderCode") || undefined, leadId: params.get("leadId") || undefined };
      if (next.phone || next.orderCode || next.leadId) void load(next);
    };
    window.addEventListener("tcr:whatsapp-select-conversation", select);
    window.addEventListener("tcr:whatsapp-outbound", refresh);
    window.addEventListener("tcr:whatsapp-inbound", inbound);
    window.addEventListener("tcr:whatsapp-read", read);
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("tcr:whatsapp-select-conversation", select);
      window.removeEventListener("tcr:whatsapp-outbound", refresh);
      window.removeEventListener("tcr:whatsapp-inbound", inbound);
      window.removeEventListener("tcr:whatsapp-read", read);
      window.removeEventListener("popstate", pop);
    };
  }, [load]);

  const contact = conversation.contact;
  const selectedPhone = selection.phone || contact?.phone || "";
  const eventTags = contact?.eventTitle?.split(" em ") || [];
  let lastDay = "";
  return <div className="crmWhatsappConversation">
    <WhatsAppMessageScroller conversationKey={`${contact?.phone || "empty"}:${conversation.messages.at(-1)?.id || "none"}`}/>
    {error ? <div className="crmWhatsappFeedback isError" role="alert">{error}</div> : null}
    {loading ? <div className="crmWhatsappNotice" role="status">Abrindo conversa…</div> : null}
    {contact?.phone && hasUnread && !loading && phoneKey(contact.phone) === phoneKey(selectedPhone) ? <WhatsAppReadMarker key={`${contact.phone}:${[...conversation.messages].reverse().find((message) => message.direction === "inbound")?.id || "none"}`} phone={contact.phone} messageId={[...conversation.messages].reverse().find((message) => message.direction === "inbound")?.id || null}/> : null}
    <header className="crmWhatsappConversationHeader"><div className="crmWhatsappContactIdentity"><span className="crmWhatsappContactAvatar">{initials(contact?.name)}</span><span><strong>{contact?.name || "Selecione uma conversa"}</strong><small>{contact?.phone || "Caixa de entrada do WhatsApp"}</small></span></div><div className="crmWhatsappContactTags">{eventTags[0] ? <span>{eventTags[0]}</span> : null}{eventTags[1] ? <span>{eventTags[1]}</span> : null}{contact ? <span className="isBuyer">• Comprador</span> : null}</div><div className="crmWhatsappConversationActions">{contact ? <Link href={contact.orderCode ? `/admin/crm?search=${encodeURIComponent(contact.orderCode)}` : "/admin/crm"}>Ver no Kanban</Link> : null}{contact ? <form action={setCrmWhatsAppAiMode}><input name="orderCode" type="hidden" value={selection.orderCode || ""}/><input name="leadId" type="hidden" value={selection.leadId || ""}/><input name="phone" type="hidden" value={selectedPhone}/><input name="mode" type="hidden" value={aiState.mode === "ACTIVE" ? "PAUSED" : "ACTIVE"}/><button title={aiState.reason || ""} type="submit" style={{ appearance: "none", background: aiState.mode === "ACTIVE" ? "#ecfdf5" : aiState.mode === "HANDOFF" ? "#fff7ed" : "#fff", border: `1px solid ${aiState.mode === "ACTIVE" ? "#34d399" : aiState.mode === "HANDOFF" ? "#fb923c" : "#cbd5e1"}`, borderRadius: 10, color: aiState.mode === "ACTIVE" ? "#047857" : aiState.mode === "HANDOFF" ? "#c2410c" : "#334155", cursor: "pointer", fontSize: 12, fontWeight: 800, minHeight: 36, padding: "0 12px" }}>{aiState.mode === "ACTIVE" ? "IA atendendo" : aiState.mode === "HANDOFF" ? "Atendente solicitado" : "Ativar IA"}</button></form> : null}<span className={conversation.canReply ? "isOpen" : "isClosed"}>{conversation.canReply ? "Atendimento aberto" : "Fora da janela de 24h"}</span></div></header>
    <div className="crmWhatsappMessages">{conversation.hiddenFailureCount > 0 ? <div className="crmWhatsappNotice">{conversation.hiddenFailureCount} tentativa(s) antiga(s) com falha técnica foram ocultadas.</div> : null}{conversation.messages.length === 0 ? <div className="crmWhatsappEmpty">Nenhuma mensagem registrada com este contato ainda.</div> : conversation.messages.map((message) => { const currentDay = dayLabel(message.createdAt); const showDay = currentDay !== lastDay; lastDay = currentDay; return <div className="crmWhatsappMessageGroup" key={message.id}>{showDay ? <div className="crmWhatsappDateDivider">{currentDay}</div> : null}<article className={`crmWhatsappBubble ${message.direction === "inbound" ? "isInbound" : "isOutbound"}`}>{templateLabel(message.templateName) ? <span className="crmWhatsappTemplate">{templateLabel(message.templateName)}</span> : null}<MessageMedia media={message.media}/><p>{message.content}</p>{message.errorMessage ? <small className="crmWhatsappError">{message.errorMessage}</small> : null}{message.errorDetails ? <small className="crmWhatsappErrorDetails">{message.errorDetails}</small> : null}<footer><time>{timeLabel(message.createdAt)}</time>{message.direction === "outbound" ? "✓" : null}</footer></article></div>; })}<WhatsAppLiveMessages key={`${contact?.phone || "empty"}:${conversation.messages.at(-1)?.id || "none"}`} phone={contact?.phone}/></div>
    <WhatsAppComposer canReply={conversation.canReply} leadId={selection.leadId || ""} orderCode={selection.orderCode || contact?.orderCode || ""} phone={selectedPhone}/>
    {!conversation.canReply && contact?.phone ? <form action={sendCrmWhatsAppApprovedTemplate} className="crmWhatsappTemplateComposer"><input name="orderCode" type="hidden" value={selection.orderCode || contact.orderCode || ""}/><input name="leadId" type="hidden" value={selection.leadId || ""}/><input name="phone" type="hidden" value={selectedPhone}/><p>Fora da janela de 24h. Use um template aprovado para iniciar a conversa.</p><button className="crmSecondaryButton" type="submit" disabled={!contact.orderCode}>Enviar template aprovado</button></form> : null}
  </div>;
}
