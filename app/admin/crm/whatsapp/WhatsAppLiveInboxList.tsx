"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { moveCrmWhatsAppConversation, setCrmWhatsAppFollowUp, setCrmWhatsAppRefundCategory } from "@/features/crm/whatsapp-chat.actions";
import { shouldClearUnread } from "@/features/crm/whatsapp-inbox-classification";
import type { getCrmWhatsAppInbox } from "@/features/crm/whatsapp-chat.service";

type Item = Awaited<ReturnType<typeof getCrmWhatsAppInbox>>[number];
type Incoming = { id: string; at: string; name: string; message: string; phone: string | null };
type Period = { period: string; start: string; end: string };
const phoneKey = (value: string | null | undefined) => String(value || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
const timeLabel = (value: Date) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(value);
const dayKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).format(value);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function dayLabel(value: Date) {
  const key = dayKey(value);
  if (key === dayKey(new Date())) return "Hoje";
  if (key === dayKey(new Date(Date.now() - 86400000))) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(value);
}

function statusLabel(item: Item) {
  if (item.aiMode === "HANDOFF") return "Atendente solicitado";
  if (item.closedManually) return "Atendimento fechado";
  if (item.isClosed) return "Compra confirmada";
  if (item.followUp) return "Follow-up";
  if (item.abandonedWithoutReturn) return "Carrinho sem retorno";
  if (item.hasUnread) return "Nova mensagem";
  return "Conversa pelo WhatsApp";
}

export function WhatsAppLiveInboxList({
  initialItems, activeStatus, selectedOrderCode, selectedPhone, search, period, displayLimit
}: {
  initialItems: Item[];
  activeStatus: string;
  selectedOrderCode?: string;
  selectedPhone?: string;
  search?: string;
  period: Period;
  displayLimit: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [currentStatus, setCurrentStatus] = useState(activeStatus);
  const [limit, setLimit] = useState(displayLimit);
  const [selectedKey, setSelectedKey] = useState(phoneKey(selectedPhone));
  useEffect(() => setItems(initialItems), [initialItems]);
  useEffect(() => setCurrentStatus(activeStatus), [activeStatus]);
  useEffect(() => setLimit(displayLimit), [displayLimit]);
  useEffect(() => setSelectedKey(phoneKey(selectedPhone)), [selectedPhone]);

  useEffect(() => {
    const onStatus = (event: Event) => setCurrentStatus((event as CustomEvent<{ status: string }>).detail.status);
    window.addEventListener("tcr:whatsapp-status", onStatus);
    return () => window.removeEventListener("tcr:whatsapp-status", onStatus);
  }, []);

  useEffect(() => {
    const onIncoming = (event: Event) => {
      const message = (event as CustomEvent<Incoming>).detail;
      const key = phoneKey(message.phone);
      if (!key) return;
      setItems((current) => {
        const existing = current.find((item) => item.key === key);
        const latestAt = new Date(message.at);
        const updated: Item = existing
          ? { ...existing, latestAt, latestMessage: message.message, latestInboundAt: latestAt, latestInboundId: message.id, latestInboundMessage: message.message, hasUnread: true, unreadQueue: true, needsReply: true, canReply: true, lastDirection: "inbound" }
          : { key, name: message.name, phone: message.phone || "", eventTitle: "Conversa pelo WhatsApp", orderCode: null, latestMessage: message.message, latestAt, latestInboundAt: latestAt, latestInboundId: message.id, latestInboundMessage: message.message, needsReply: true, hasUnread: true, unreadQueue: true, hasHumanReply: false, humanQueueHidden: false, isRefund: false, followUp: false, isClosed: false, closedManually: false, abandonedWithoutReturn: false, canReply: true, lastDirection: "inbound", lastOutboundAt: null, aiMode: "ACTIVE" };
        const term = String(search || "").trim().toLocaleLowerCase("pt-BR");
        if (term && ![updated.name, updated.phone, updated.eventTitle, updated.orderCode, updated.latestMessage].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term))) {
          return current.filter((item) => item.key !== key);
        }
        return [updated, ...current.filter((item) => item.key !== key)];
      });
    };
    const onRead = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string; messageId?: string }>).detail;
      const key = phoneKey(detail?.phone);
      setItems((current) => current.map((item) => item.key === key && shouldClearUnread(item.latestInboundId, detail.messageId) ? { ...item, hasUnread: false, unreadQueue: false, needsReply: false } : item));
    };
    const onOutbound = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string; message?: string }>).detail;
      const key = phoneKey(detail?.phone);
      setItems((current) => {
        const item = current.find((candidate) => candidate.key === key);
        if (!item) return current;
        return [{ ...item, latestAt: new Date(), latestMessage: detail.message || "Mensagem enviada", lastDirection: "outbound" as const, hasHumanReply: true, hasUnread: false, unreadQueue: false, needsReply: false }, ...current.filter((candidate) => candidate.key !== key)];
      });
    };
    window.addEventListener("tcr:whatsapp-inbound", onIncoming);
    window.addEventListener("tcr:whatsapp-read", onRead);
    window.addEventListener("tcr:whatsapp-outbound", onOutbound);
    return () => {
      window.removeEventListener("tcr:whatsapp-inbound", onIncoming);
      window.removeEventListener("tcr:whatsapp-read", onRead);
      window.removeEventListener("tcr:whatsapp-outbound", onOutbound);
    };
  }, [search]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("tcr:whatsapp-unread-count", { detail: { count: items.filter((item) => item.hasUnread).length } }));
    window.dispatchEvent(new CustomEvent("tcr:whatsapp-counters", { detail: {
      all: items.length,
      unread: items.filter((item) => item.unreadQueue).length,
      human: items.filter((item) => item.hasHumanReply && !item.humanQueueHidden).length,
      refund: items.filter((item) => item.isRefund).length,
      followup: items.filter((item) => item.followUp).length,
      closed: items.filter((item) => item.isClosed).length,
      abandoned: items.filter((item) => item.abandonedWithoutReturn).length
    } }));
  }, [items]);

  const filtered = useMemo(() => items.filter((item) => currentStatus === "unread" ? item.unreadQueue : currentStatus === "human" ? item.hasHumanReply && !item.humanQueueHidden : currentStatus === "refund" ? item.isRefund : currentStatus === "followup" ? item.followUp : currentStatus === "closed" ? item.isClosed : currentStatus === "abandoned" ? item.abandonedWithoutReturn : true), [items, currentStatus]);
  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  let lastDay = "";
  return <nav className="crmWhatsappInboxList" aria-label="Conversas do WhatsApp">
    {filtered.length === 0 ? <p className="crmWhatsappInboxEmpty">Nenhuma conversa encontrada.</p> : null}
    {visible.map((item) => {
      const query = new URLSearchParams();
      if (item.orderCode) query.set("orderCode", item.orderCode); else query.set("phone", item.phone);
      if (search) query.set("search", search);
      if (currentStatus !== "all") query.set("status", currentStatus);
      query.set("period", period.period);
      if (period.period === "custom") { query.set("startDate", period.start); query.set("endDate", period.end); }
      const isActive = selectedKey === item.key || (selectedOrderCode && selectedOrderCode === item.orderCode && !selectedKey);
      const tags = item.eventTitle.split(" em ");
      const currentDay = dayKey(item.latestAt);
      const showDay = currentDay !== lastDay;
      lastDay = currentDay;
      return <div key={item.key}>
        {showDay ? <div style={{ padding: "9px 14px 5px", color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>{dayLabel(item.latestAt)}</div> : null}
        <div className={`crmWhatsappInboxItem ${isActive ? "isActive" : ""}`}>
          <Link className="crmWhatsappInboxMainLink" href={`/admin/crm/whatsapp?${query}`} onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            setSelectedKey(item.key);
            window.history.pushState(null, "", `/admin/crm/whatsapp?${query}`);
            window.dispatchEvent(new CustomEvent("tcr:whatsapp-select-conversation", { detail: { phone: item.phone, orderCode: item.orderCode, hasUnread: item.hasUnread } }));
          }} prefetch={false} scroll={false}>
            <span className="crmWhatsappInboxAvatar">{initials(item.name)}</span>
            <span className="crmWhatsappInboxCopy"><span className="crmWhatsappInboxName"><strong>{item.name}</strong><time>{timeLabel(item.latestAt)}</time></span><span className="crmWhatsappInboxPreview">{item.lastDirection === "outbound" ? "Você: " : ""}{item.latestMessage}</span><span className="crmWhatsappInboxTags"><small>{statusLabel(item)}</small><small>{tags[0]}</small>{tags[1] ? <small>{tags[1]}</small> : null}</span></span>
            {item.hasUnread ? <i title="Mensagem nova ainda não visualizada">1</i> : null}
          </Link>
          <details className="crmWhatsappInboxMenu"><summary aria-label={`Opções de ${item.name}`}>⋮</summary><div className="crmWhatsappInboxMenuActions">
            {currentStatus === "human" ? ([
              ["all", "Mover para Todos"], ["refund", "Mover para Estorno"],
              ["followup", "Mover para Em atendimento / Follow-up"], ["closed", "Mover para Fechados"]
            ] as const).map(([destination, label]) => <form action={moveCrmWhatsAppConversation} key={destination}><input name="phone" type="hidden" value={item.phone}/><input name="destination" type="hidden" value={destination}/><button type="submit">{label}</button></form>) : null}
            {currentStatus !== "human" && item.hasHumanReply && item.humanQueueHidden ? <form action={moveCrmWhatsAppConversation}><input name="phone" type="hidden" value={item.phone}/><input name="destination" type="hidden" value="human"/><button type="submit">Restaurar em Atendimento humano</button></form> : null}
            {currentStatus !== "human" && currentStatus !== "followup" && !item.followUp ? <form action={setCrmWhatsAppFollowUp}><input name="phone" type="hidden" value={item.phone}/><input name="enabled" type="hidden" value="true"/><button type="submit">Adicionar a Follow-up</button></form> : null}
            {currentStatus === "followup" && item.followUp ? <form action={setCrmWhatsAppFollowUp}><input name="phone" type="hidden" value={item.phone}/><input name="enabled" type="hidden" value="false"/><button type="submit">Remover de Follow-up</button></form> : null}
            {currentStatus !== "human" && currentStatus !== "refund" && !item.isRefund ? <form action={setCrmWhatsAppRefundCategory}><input name="phone" type="hidden" value={item.phone}/><input name="enabled" type="hidden" value="true"/><button type="submit">Classificar como Estorno</button></form> : null}
            {currentStatus === "refund" && item.isRefund ? <form action={setCrmWhatsAppRefundCategory}><input name="phone" type="hidden" value={item.phone}/><input name="enabled" type="hidden" value="false"/><button type="submit">Remover de Estorno</button></form> : null}
            {currentStatus !== "human" && currentStatus !== "closed" && !item.isClosed ? <form action={moveCrmWhatsAppConversation}><input name="phone" type="hidden" value={item.phone}/><input name="destination" type="hidden" value="closed"/><button type="submit">Mover para Fechados</button></form> : null}
          </div>
          </details>
        </div>
      </div>;
    })}
    {visible.length < filtered.length ? <button className="crmWhatsappInboxEmpty crmWhatsappLoadMore" onClick={() => setLimit((value) => value + 120)} type="button">Carregar mais conversas ({filtered.length - visible.length} restantes)</button> : null}
  </nav>;
}
