"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
export function WhatsAppReadMarker({ phone, messageId }: { phone: string; messageId: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
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
        window.dispatchEvent(new CustomEvent("tcr:whatsapp-read", { detail: { phone } }));
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }
  return <button className="crmSecondaryButton" type="button" onClick={markRead} disabled={!messageId || pending}>
    {pending ? "Marcando..." : "Marcar como lida"}
  </button>;
}
