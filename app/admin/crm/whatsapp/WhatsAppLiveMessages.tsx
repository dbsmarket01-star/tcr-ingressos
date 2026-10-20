"use client";

import { useEffect, useState } from "react";

type Incoming = { id: string; at: string; name: string; message: string; phone: string | null };
const phoneKey = (value: string | null | undefined) => String(value || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

export function WhatsAppLiveMessages({ phone }: { phone: string | null | undefined }) {
  const [messages, setMessages] = useState<Incoming[]>([]);
  const [unreadMessageId, setUnreadMessageId] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const key = phoneKey(phone);
  useEffect(() => { setMessages([]); setUnreadMessageId(null); }, [key]);
  useEffect(() => {
    const onIncoming = (event: Event) => {
      const message = (event as CustomEvent<Incoming>).detail;
      if (phoneKey(message.phone) !== key) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setUnreadMessageId(message.id);
    };
    window.addEventListener("tcr:whatsapp-inbound", onIncoming);
    return () => window.removeEventListener("tcr:whatsapp-inbound", onIncoming);
  }, [key]);
  useEffect(() => {
    if (!messages.length) return;
    const panel = document.querySelector(".crmWhatsappMessages");
    panel?.scrollTo({ top: panel.scrollHeight, behavior: "smooth" });
  }, [messages]);
  async function markRead() {
    if (!phone || !unreadMessageId || marking) return;
    setMarking(true);
    try {
      const response = await fetch("/api/admin/crm/whatsapp/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, messageId: unreadMessageId }) });
      if (response.ok) {
        setUnreadMessageId(null);
        window.dispatchEvent(new CustomEvent("tcr:whatsapp-read", { detail: { phone } }));
      }
    } finally { setMarking(false); }
  }
  return <>{messages.map((message) => <div className="crmWhatsappMessageGroup" key={message.id}>
    <article className="crmWhatsappBubble isInbound"><p>{message.message}</p><footer><time>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(message.at))}</time></footer></article>
  </div>)}{unreadMessageId ? <button className="crmSecondaryButton" disabled={marking} onClick={markRead} type="button">{marking ? "Marcando..." : "Marcar como lida"}</button> : null}</>;
}
