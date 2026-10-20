"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const periods = [["all", "Todo o histórico"], ["today", "Hoje"], ["yesterday", "Ontem"], ["week", "Esta semana"], ["month", "Este mês"], ["lastMonth", "Mês passado"]];

export function WhatsAppPeriodBar({ status: initialStatus, period, start, end, search }: { status: string; period: string; start: string; end: string; search?: string }) {
  const [status, setStatus] = useState(initialStatus);
  useEffect(() => setStatus(initialStatus), [initialStatus]);
  useEffect(() => {
    const onStatus = (event: Event) => setStatus((event as CustomEvent<{ status: string }>).detail.status);
    window.addEventListener("tcr:whatsapp-status", onStatus);
    return () => window.removeEventListener("tcr:whatsapp-status", onStatus);
  }, []);
  function href(nextPeriod: string) {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (search) query.set("search", search);
    query.set("period", nextPeriod);
    return `/admin/crm/whatsapp?${query}`;
  }
  return <form action="/admin/crm/whatsapp" className="crmWhatsappPeriodBar" method="get">
    {status !== "all" ? <input name="status" type="hidden" value={status}/> : null}
    {search ? <input name="search" type="hidden" value={search}/> : null}
    {periods.map(([value, label]) => <Link className={period === value ? "isActive" : ""} href={href(value)} key={value} prefetch={false}>{label}</Link>)}
    <label><span>De</span><input defaultValue={start} name="startDate" type="date"/></label>
    <label><span>Até</span><input defaultValue={end} name="endDate" type="date"/></label>
    <button name="period" type="submit" value="custom">Aplicar período</button>
  </form>;
}
