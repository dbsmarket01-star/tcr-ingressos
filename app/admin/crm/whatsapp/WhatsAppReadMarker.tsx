"use client";

import { useEffect } from "react";
export function WhatsAppReadMarker({ phone, messageId }: { phone: string; messageId: string | null }) {
  useEffect(() => {
    if (!phone || !messageId) return;
    window.dispatchEvent(new CustomEvent("tcr:whatsapp-read", { detail: { phone } }));
    const controller = new AbortController();
    void fetch("/api/admin/crm/whatsapp/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, messageId }),
      signal: controller.signal
    }).catch(() => undefined);
    return () => controller.abort();
  }, [messageId, phone]);
  return null;
}
