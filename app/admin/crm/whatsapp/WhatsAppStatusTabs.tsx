"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Counts = { all: number; unread: number; human: number; refund: number; followup: number; closed: number; abandoned: number };
const tabs: Array<[keyof Counts, string]> = [
  ["all", "Todos"], ["unread", "Não lidos"], ["human", "Atendimento humano"],
  ["refund", "Estorno"], ["followup", "Em atendimento / Follow-up"],
  ["closed", "Fechados"], ["abandoned", "Carrinho abandonado sem retorno"]
];

export function WhatsAppStatusTabs({ initialStatus, initialCounts, period }: { initialStatus: string; initialCounts: Counts; period: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [counts, setCounts] = useState(initialCounts);
  useEffect(() => setCounts(initialCounts), [initialCounts]);
  useEffect(() => setStatus(initialStatus), [initialStatus]);
  useEffect(() => {
    const onCounters = (event: Event) => setCounts((event as CustomEvent<Counts>).detail);
    const onPopState = () => {
      const next = new URL(window.location.href).searchParams.get("status") || "all";
      setStatus(next);
      window.dispatchEvent(new CustomEvent("tcr:whatsapp-status", { detail: { status: next } }));
    };
    window.addEventListener("tcr:whatsapp-counters", onCounters);
    window.addEventListener("popstate", onPopState);
    return () => { window.removeEventListener("tcr:whatsapp-counters", onCounters); window.removeEventListener("popstate", onPopState); };
  }, []);
  function select(next: string) {
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("status"); else url.searchParams.set("status", next);
    if ((next === "human" || next === "refund") && period === "today") {
      url.searchParams.set("period", "all");
      router.push(`${url.pathname}${url.search}`);
      return;
    }
    window.history.pushState(null, "", url);
    setStatus(next);
    window.dispatchEvent(new CustomEvent("tcr:whatsapp-status", { detail: { status: next } }));
  }
  return <nav className="crmWhatsappStatusTabs" aria-label="Filtrar conversas por status">{tabs.map(([key, label]) => <button aria-pressed={status === key} className={`${status === key ? "isActive" : ""} ${key === "human" ? "isHuman" : ""}`.trim()} key={key} onClick={() => select(key)} type="button">{label}<b>{counts[key]}</b></button>)}</nav>;
}
