"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function WhatsAppReadMarker({ phone, messageId }: { phone: string; messageId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!phone || !messageId) return;
    window.dispatchEvent(new CustomEvent("tcr:whatsapp-read", { detail: { phone } }));
    void fetch("/api/admin/crm/whatsapp/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, messageId }),
      keepalive: true
    }).then((response) => {
      if (response.ok) router.refresh();
    }).catch(() => undefined);
  }, [messageId, phone, router]);
  return null;
}
