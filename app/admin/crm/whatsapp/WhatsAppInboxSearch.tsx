"use client";

import { useEffect, useState } from "react";

export function WhatsAppInboxSearch({ status: initialStatus, period, start, end, search }: { status: string; period: string; start: string; end: string; search?: string }) {
  const [status, setStatus] = useState(initialStatus);
  useEffect(() => setStatus(initialStatus), [initialStatus]);
  useEffect(() => {
    const onStatus = (event: Event) => setStatus((event as CustomEvent<{ status: string }>).detail.status);
    window.addEventListener("tcr:whatsapp-status", onStatus);
    return () => window.removeEventListener("tcr:whatsapp-status", onStatus);
  }, []);
  return <form action="/admin/crm/whatsapp" className="crmWhatsappInboxSearch" method="get">
    {status !== "all" ? <input name="status" type="hidden" value={status}/> : null}
    <input name="period" type="hidden" value={period}/>
    {period === "custom" ? <><input name="startDate" type="hidden" value={start}/><input name="endDate" type="hidden" value={end}/></> : null}
    <label><svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg><input name="search" placeholder="Buscar conversa..." defaultValue={search || ""}/></label>
    <button aria-label="Aplicar busca" type="submit"><svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg></button>
  </form>;
}
