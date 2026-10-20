"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { sendCrmWhatsAppApprovedTemplate, setCrmWhatsAppAiMode } from "@/features/crm/whatsapp-chat.actions";
import { shouldClearUnread } from "@/features/crm/whatsapp-inbox-classification";
import { mergeWhatsAppMessages } from "@/features/crm/whatsapp-live-delta";
import type { getCrmWhatsAppConversation } from "@/features/crm/whatsapp-chat.service";
import { WhatsAppComposer } from "./WhatsAppComposer";
import { WhatsAppReadMarker } from "./WhatsAppReadMarker";
import { WhatsAppMessageScroller } from "./WhatsAppMessageScroller";

type Conversation = Awaited<ReturnType<typeof getCrmWhatsAppConversation>>;
type Selection = { phone?: string; orderCode?: string | null; leadId?: string };
type AiState = { mode: string; reason?: string | null };
type Incoming = { id: string; at: string; phone: string | null; message: string; media?: Conversation["messages"][number]["media"] };
const phoneKey = (value: string | null | undefined) => String(value || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
const initials = (name?: string | null) => String(name || "WA").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const timeLabel = (date: Date) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
const dayLabel = (date: Date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date);
const templateLabel = (name: string | null) => !name ? null : name.startsWith("abandono_carrinho_tcr_botao") ? "Carrinho abandonado" : name.startsWith("abandono_carrinho_tcr_followup") ? "Follow-up de carrinho" : "Mensagem automática";
const incomingMessage = (value: Incoming): Conversation["messages"][number] => ({
  id: value.id,
  direction: "inbound",
  status: "RECEIVED",
  templateName: null,
  content: value.message,
  media: value.media || null,
  createdAt: new Date(value.at),
  errorMessage: null,
  errorDetails: null
});

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
  const [selection, setSelection] = useState<Selection>({ ...initialSelection, phone: initialSelection.phone || initialConversation.contact?.phone || undefined });
  const [hasUnread, setHasUnread] = useState(initialHasUnread);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const historyScrollAnchor = useRef<{ height: number; top: number } | null>(null);
  const activeRequestId = useRef<number | null>(null);
  const pendingInbound = useRef(new Map<string, { phone: string; message: Conversation["messages"][number] }>());
  const selectionRef = useRef<Selection>({ ...initialSelection, phone: initialSelection.phone || initialConversation.contact?.phone || undefined });
  const latestInboundIdRef = useRef([...initialConversation.messages].reverse().find((message) => message.direction === "inbound")?.id || null);
  const load = useCallback(async (next: Selection, silent = false) => {
    const id = ++requestId.current;
    activeRequestId.current = id;
    selectionRef.current = next;
    setSelection(next);
    setError("");
    setHistoryError("");
    setHistoryLoading(false);
    historyScrollAnchor.current = null;
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
      const normalized = data.conversation.messages.map((message) => ({ ...message, createdAt: new Date(message.createdAt) }));
      const resolvedPhoneKey = phoneKey(data.conversation.contact?.phone || next.phone);
      const pending = Array.from(pendingInbound.current.values()).filter((entry) => entry.phone === resolvedPhoneKey).map((entry) => entry.message);
      const messages = mergeWhatsAppMessages(normalized, pending);
      pendingInbound.current.clear();
      latestInboundIdRef.current = [...messages].reverse().find((message) => message.direction === "inbound")?.id || null;
      setSelection(resolvedSelection);
      setConversation({ ...data.conversation, messages, canReply: data.conversation.canReply || pending.length > 0 } as Conversation);
      setAiState(data.aiState);
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : "Falha ao abrir a conversa.");
    } finally {
      if (id === requestId.current) {
        activeRequestId.current = null;
        setLoading(false);
      }
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!conversation.historyHasMore || !conversation.historyCursor || historyLoading) return;
    const id = requestId.current;
    const query = new URLSearchParams();
    const selected = selectionRef.current;
    if (selected.orderCode) query.set("orderCode", selected.orderCode);
    else if (selected.phone) query.set("phone", selected.phone);
    if (selected.leadId) query.set("leadId", selected.leadId);
    query.set("beforeAt", conversation.historyCursor.at);
    query.set("beforeId", conversation.historyCursor.id);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetch(`/api/admin/crm/whatsapp/conversation?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar mensagens anteriores.");
      const data = await response.json() as { conversation: Conversation };
      if (id !== requestId.current) return;
      const container = document.querySelector<HTMLElement>(".crmWhatsappMessages");
      historyScrollAnchor.current = container ? { height: container.scrollHeight, top: container.scrollTop } : null;
      const older = data.conversation.messages.map((message) => ({ ...message, createdAt: new Date(message.createdAt) }));
      setConversation((current) => current.contact ? {
        ...current,
        messages: mergeWhatsAppMessages(current.messages, older, current.messages.length + older.length),
        hiddenFailureCount: current.hiddenFailureCount + data.conversation.hiddenFailureCount,
        historyHasMore: data.conversation.historyHasMore,
        historyCursor: data.conversation.historyCursor
      } : current);
    } catch (reason) {
      if (id === requestId.current) setHistoryError(reason instanceof Error ? reason.message : "Falha ao carregar o histórico.");
    } finally {
      if (id === requestId.current) setHistoryLoading(false);
    }
  }, [conversation.historyCursor, conversation.historyHasMore, historyLoading]);

  useLayoutEffect(() => {
    const anchor = historyScrollAnchor.current;
    if (!anchor) return;
    const container = document.querySelector<HTMLElement>(".crmWhatsappMessages");
    if (container) container.scrollTop = anchor.top + container.scrollHeight - anchor.height;
    historyScrollAnchor.current = null;
  }, [conversation.messages]);

  useEffect(() => {
    const select = (event: Event) => {
      const detail = (event as CustomEvent<Selection & { hasUnread?: boolean }>).detail;
      pendingInbound.current.clear();
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
      const detail = (event as CustomEvent<Incoming>).detail;
      const key = phoneKey(detail?.phone);
      if (!key) return;
      const message = incomingMessage(detail);
      if (activeRequestId.current !== null) pendingInbound.current.set(message.id, { phone: key, message });
      if (pendingInbound.current.size > 80) pendingInbound.current.delete(pendingInbound.current.keys().next().value!);
      if (key !== phoneKey(selectionRef.current.phone)) return;
      latestInboundIdRef.current = message.id;
      setHasUnread(true);
      setConversation((current) => current.contact ? { ...current, messages: mergeWhatsAppMessages(current.messages, [message], Math.max(80, current.messages.length + 1)), canReply: true } : current);
    };
    const read = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string; messageId?: string }>).detail;
      if (phoneKey(detail?.phone) !== phoneKey(selectionRef.current.phone)) return;
      if (shouldClearUnread(latestInboundIdRef.current, detail.messageId)) setHasUnread(false);
    };
    const pop = () => {
      const params = new URL(window.location.href).searchParams;
      const next = { phone: params.get("phone") || undefined, orderCode: params.get("orderCode") || undefined, leadId: params.get("leadId") || undefined };
      if (next.phone || next.orderCode || next.leadId) { pendingInbound.current.clear(); void load(next); }
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
    <div className="crmWhatsappMessages">{conversation.historyHasMore ? <button className="crmSecondaryButton" disabled={historyLoading} onClick={() => void loadOlderMessages()} type="button">{historyLoading ? "Carregando mensagens anteriores…" : "Carregar mensagens anteriores"}</button> : null}{historyError ? <div className="crmWhatsappFeedback isError" role="alert">{historyError}</div> : null}{conversation.hiddenFailureCount > 0 ? <div className="crmWhatsappNotice">{conversation.hiddenFailureCount} tentativa(s) antiga(s) com falha técnica foram ocultadas.</div> : null}{conversation.messages.length === 0 ? <div className="crmWhatsappEmpty">Nenhuma mensagem registrada com este contato ainda.</div> : conversation.messages.map((message) => { const currentDay = dayLabel(message.createdAt); const showDay = currentDay !== lastDay; lastDay = currentDay; return <div className="crmWhatsappMessageGroup" key={message.id}>{showDay ? <div className="crmWhatsappDateDivider">{currentDay}</div> : null}<article className={`crmWhatsappBubble ${message.direction === "inbound" ? "isInbound" : "isOutbound"}`}>{templateLabel(message.templateName) ? <span className="crmWhatsappTemplate">{templateLabel(message.templateName)}</span> : null}<MessageMedia media={message.media}/><p>{message.content}</p>{message.errorMessage ? <small className="crmWhatsappError">{message.errorMessage}</small> : null}{message.errorDetails ? <small className="crmWhatsappErrorDetails">{message.errorDetails}</small> : null}<footer><time>{timeLabel(message.createdAt)}</time>{message.direction === "outbound" ? "✓" : null}</footer></article></div>; })}</div>
    <WhatsAppComposer canReply={conversation.canReply} leadId={selection.leadId || ""} orderCode={selection.orderCode || contact?.orderCode || ""} phone={selectedPhone}/>
    {!conversation.canReply && contact?.phone ? <form action={sendCrmWhatsAppApprovedTemplate} className="crmWhatsappTemplateComposer"><input name="orderCode" type="hidden" value={selection.orderCode || contact.orderCode || ""}/><input name="leadId" type="hidden" value={selection.leadId || ""}/><input name="phone" type="hidden" value={selectedPhone}/><p>Fora da janela de 24h. Use um template aprovado para iniciar a conversa.</p><button className="crmSecondaryButton" type="submit" disabled={!contact.orderCode}>Enviar template aprovado</button></form> : null}
  </div>;
}
