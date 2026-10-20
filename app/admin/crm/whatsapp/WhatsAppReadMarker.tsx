"use client";

import { useState } from "react";
export function WhatsAppReadMarker({ phone, messageId }: { phone: string; messageId: string | null }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  async function markRead() {
    if (!phone || !messageId || pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/crm/whatsapp/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, messageId }),
      keepalive: true
      });
      if (response.ok) {
        setDone(true);
        window.dispatchEvent(new CustomEvent("tcr:whatsapp-read", { detail: { phone } }));
      }
    } finally {
      setPending(false);
    }
  }
  if (done) return null;
  return <button className="crmSecondaryButton" type="button" onClick={markRead} disabled={!messageId || pending}>
    {pending ? "Marcando..." : "Marcar como lida"}
  </button>;
}
