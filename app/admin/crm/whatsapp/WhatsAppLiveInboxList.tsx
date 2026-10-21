"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { moveCrmWhatsAppConversation } from "@/features/crm/whatsapp-chat.actions";
import { isRefundRequest, shouldClearUnread } from "@/features/crm/whatsapp-inbox-classification";
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
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [menuError, setMenuError] = useState("");
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
    const closeMenus = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      document.querySelectorAll<HTMLDetailsElement>(".crmWhatsappInboxMenu[open]").forEach((menu) => {
        if (event instanceof PointerEvent && menu.contains(event.target as Node)) return;
        menu.open = false;
      });
    };
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeMenus);
    return () => { document.removeEventListener("pointerdown", closeMenus); document.removeEventListener("keydown", closeMenus); };
  }, []);

  useEffect(() => {
    const onIncoming = (event: Event) => {
      const message = (event as CustomEvent<Incoming>).detail;
      const key = phoneKey(message.phone);
      if (!key) return;
      setItems((current) => {
        const existing = current.find((item) => item.key === key);
        const latestAt = new Date(message.at);
        const refundRequest = isRefundRequest(message.message);
        const updated: Item = existing
          ? { ...existing, latestAt, latestMessage: message.message, latestInboundAt: latestAt, latestInboundId: message.id, latestInboundMessage: message.message, hasUnread: true, unreadQueue: true, needsReply: true, canReply: true, isRefund: existing.isRefund || refundRequest, queue: refundRequest ? "refund" : ["refund", "followup", "closed"].includes(existing.queue) ? existing.queue : existing.aiMode === "ACTIVE" ? "ai" : "human", lastDirection: "inbound" }
          : { key, name: message.name, phone: message.phone || "", eventTitle: "Conversa pelo WhatsApp", orderCode: null, latestMessage: message.message, latestAt, latestInboundAt: latestAt, latestInboundId: message.id, latestInboundMessage: message.message, needsReply: true, hasUnread: true, unreadQueue: true, queue: refundRequest ? "refund" : "ai", hasHumanReply: false, humanQueueHidden: false, isRefund: refundRequest, followUp: false, isClosed: false, closedManually: false, abandonedWithoutReturn: false, canReply: true, lastDirection: "inbound", lastOutboundAt: null, aiMode: "ACTIVE" };
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
        return [{ ...item, latestAt: new Date(), latestMessage: detail.message || "Mensagem enviada", lastDirection: "outbound" as const, hasHumanReply: true, hasUnread: false, unreadQueue: false, needsReply: false, queue: item.queue === "refund" ? "refund" : "human", aiMode: "PAUSED" as const }, ...current.filter((candidate) => candidate.key !== key)];
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
      ai: items.filter((item) => item.queue === "ai").length,
      human: items.filter((item) => item.queue === "human").length,
      refund: items.filter((item) => item.queue === "refund").length,
      followup: items.filter((item) => item.queue === "followup").length,
      closed: items.filter((item) => item.queue === "closed").length,
      abandoned: items.filter((item) => item.abandonedWithoutReturn).length
    } }));
  }, [items]);

  const filtered = useMemo(() => items.filter((item) => currentStatus === "ai" || currentStatus === "unread" ? item.queue === "ai" : currentStatus === "human" ? item.queue === "human" : currentStatus === "refund" ? item.queue === "refund" : currentStatus === "followup" ? item.queue === "followup" : currentStatus === "closed" ? item.queue === "closed" : currentStatus === "abandoned" ? item.abandonedWithoutReturn : true), [items, currentStatus]);
  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  async function move(item: Item, formData: FormData) {
    const queue = String(formData.get("queue") || "");
    setPendingKey(item.key);
    setMenuError("");
    try {
      const result = await moveCrmWhatsAppConversation(formData);
      if (!result.ok) { setMenuError(result.message); return; }
      setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, queue } : entry));
      document.querySelectorAll<HTMLDetailsElement>(".crmWhatsappInboxMenu[open]").forEach((menu) => { menu.open = false; });
    } catch {
      setMenuError("Não foi possível mover a conversa. Tente novamente.");
    } finally {
      setPendingKey(null);
    }
  }
  let lastDay = "";
  return <nav className="crmWhatsappInboxList" aria-label="Conversas do WhatsApp">
    {menuError ? <p className="crmWhatsappFeedback isError" role="alert">{menuError}</p> : null}
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
          <details className="crmWhatsappInboxMenu"><summary aria-label={`Opções de ${item.name}`}>⋮</summary>
            <form action={(formData) => move(item, formData)}><input name="phone" type="hidden" value={item.phone}/>
              <button disabled={pendingKey === item.key} name="queue" value="all" type="submit">Concluir e deixar em Todos</button>
              <button disabled={pendingKey === item.key} name="queue" value="ai" type="submit">Mover para Atendimento IA</button>
              <button disabled={pendingKey === item.key} name="queue" value="human" type="submit">Mover para Atendimento humano</button>
              <button disabled={pendingKey === item.key} name="queue" value="refund" type="submit">Mover para Estorno</button>
              <button disabled={pendingKey === item.key} name="queue" value="followup" type="submit">Mover para Follow-up</button>
              <button disabled={pendingKey === item.key} name="queue" value="closed" type="submit">Mover para Fechados</button>
            </form>
          </details>
        </div>
      </div>;
    })}
    {visible.length < filtered.length ? <button className="crmWhatsappInboxEmpty crmWhatsappLoadMore" onClick={() => setLimit((value) => value + 120)} type="button">Carregar mais conversas ({filtered.length - visible.length} restantes)</button> : null}
  </nav>;
}
