"use client";

import { useEffect } from "react";

export function WhatsAppMessageScroller({ conversationKey }: { conversationKey: string }) {
  useEffect(() => {
    const container = document.querySelector<HTMLElement>(".crmWhatsappMessages");
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [conversationKey]);
  return null;
}
