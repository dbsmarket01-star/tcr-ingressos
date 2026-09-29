"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function WhatsAppReadMarker({ phone, messageId }: { phone: string; messageId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!phone || !messageId) return;
    const controller = new AbortController();
    void fetch("/api/admin/crm/whatsapp/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, messageId }),
      signal: controller.signal
    }).then((response) => { if (response.ok) router.refresh(); }).catch(() => undefined);
    return () => controller.abort();
  }, [messageId, phone, router]);
  return null;
}
