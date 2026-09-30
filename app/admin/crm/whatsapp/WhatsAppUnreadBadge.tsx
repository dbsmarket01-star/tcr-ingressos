"use client";

import { useEffect, useState } from "react";

export function WhatsAppUnreadBadge({ phone }: { phone: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string }>).detail;
      const normalize = (value?: string) => String(value || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      if (normalize(detail?.phone) === normalize(phone)) setVisible(false);
    };
    window.addEventListener("tcr:whatsapp-read", listener);
    return () => window.removeEventListener("tcr:whatsapp-read", listener);
  }, [phone]);

  return visible ? <i title="Mensagem nova ainda não visualizada">1</i> : null;
}
