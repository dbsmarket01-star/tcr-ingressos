"use client";

import { useCallback, useEffect, useRef, useState } from "react";
export function WhatsAppReadMarker({ phone, messageId }: { phone: string; messageId: string | null }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const markRead = useCallback(async () => {
    if (!phone || !messageId || inFlight.current || document.hidden) return;
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/admin/crm/whatsapp/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, messageId }),
        keepalive: true
      });
      if (!response.ok) throw new Error("Não foi possível registrar a leitura.");
      setDone(true);
      window.dispatchEvent(new CustomEvent("tcr:whatsapp-read", { detail: { phone, messageId } }));
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [phone, messageId]);
  useEffect(() => {
    if (done || !messageId) return;
    void markRead();
    const onVisible = () => { if (!document.hidden) void markRead(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead, messageId, done]);
  if (done || !failed) return null;
  return <button className="crmSecondaryButton" type="button" onClick={() => void markRead()} disabled={pending}>
    {pending ? "Tentando..." : "Falha ao marcar como lida — tentar novamente"}
  </button>;
}
