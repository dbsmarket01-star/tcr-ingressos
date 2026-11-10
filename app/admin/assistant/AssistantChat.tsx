"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { assistantAcknowledgement } from "@/features/assistant/assistant-request";
import type { ImportProposal } from "@/features/assistant/assistant-event-import";
import { ImportReview, ImportSummary } from "./ImportReview";
import styles from "./assistant.module.css";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string; createdAt: string; authorName?: string | null; imageId?: string | null; imageName?: string | null; previewUrl?: string };
type Proposal = ImportProposal | { kind: "PRICE_CHANGE"; id: string; eventTitle: string; lotName: string; oldPriceInCents: number; newPriceInCents: number }
  | { kind: "EVENT_CREATE"; id: string; eventTitle: string; draft: { startsAt: string; venueName: string; venueAddress: string; city: string; state: string; slug: string; bannerUrl: string; eventMapImageUrl: string } }
  | { kind: "EVENT_DETAILS_CHANGE"; id: string; eventTitle: string; changes: Array<{ field: string; oldValue: string; value: string }> }
  | { kind: "EVENT_STATUS_CHANGE"; id: string; eventTitle: string; oldStatus: "PUBLISHED" | "UNPUBLISHED"; newStatus: "PUBLISHED" | "UNPUBLISHED" }
  | { kind: "LOT_ORDER_CHANGE"; id: string; eventTitle: string; orderedNames: string[] }
  | { kind: "LOT_CHANGES"; id: string; eventTitle: string; changes: Array<{ operation: "CREATE" | "UPDATE"; oldName: string; name: string; oldPriceInCents: number; priceInCents: number; oldTotalQuantity: number; totalQuantity: number; oldStatus: string; status: string; description: string; oldHighlightColor?: string; highlightColor?: string; oldServiceFeeBps?: number; serviceFeeBps?: number; cardInterestBpsPerInstallment?: number; cardInterestStartsAtInstallment?: number }> };

const eventFieldLabels: Record<string, string> = {
  title: "Nome do evento", subtitle: "Subtítulo", description: "Descrição", startsAt: "Data e horário",
  doorsOpenAt: "Abertura dos portões", endsAt: "Encerramento", salesStartsAt: "Início das vendas", salesEndsAt: "Fim das vendas",
  venueName: "Local", venueAddress: "Endereço", city: "Cidade", state: "Estado", bannerUrl: "Banner", eventMapImageUrl: "Mapa",
  eventMapNotes: "Observações do mapa", eventMapTemplate: "Modelo do mapa", importantInfo: "Informações importantes"
};
function proposalValue(value: string, field: string) {
  if (value && ["startsAt", "doorsOpenAt", "endsAt", "salesStartsAt", "salesEndsAt"].includes(field)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return `${date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)`;
  }
  return value.startsWith("assistant-image:") ? "Imagem anexada" : value || "(vazio)";
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AssistantChat({ name }: { name: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("today");
  const [selectedDate, setSelectedDate] = useState("");
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const operationVersion = useRef(0);
  busyRef.current = busy;

  useEffect(() => {
    if (!image) { setImagePreview(""); return; }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 2 * 1024 * 1024) {
      setError("Envie uma imagem JPG, PNG ou WEBP de até 2 MB.");
      event.target.value = "";
      return;
    }
    setError(""); setImage(selected);
  }

  useEffect(() => {
    if (period === "date" && !selectedDate) { setMessages([]); setLoading(false); return; }
    let active = true;
    const params = new URLSearchParams({ period });
    if (period === "date") params.set("date", selectedDate);
    setLoading(true); setMessages([]); setNextBefore(null);
    async function refresh(initial: boolean) {
      const version = operationVersion.current;
      try {
        const response = await fetch(`/api/admin/assistant?${params}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Não foi possível carregar a conversa.");
        if (!active || busyRef.current || version !== operationVersion.current) return;
        setMessages((current) => initial ? body.messages || [] : [...new Map([...current, ...(body.messages || [])].map((item: ChatMessage) => [item.id, item])).values()]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
        if (initial) setNextBefore(body.nextBefore || null);
        setProposal(body.proposal || null);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar a conversa.");
      } finally { if (initial && active) setLoading(false); }
    }
    void refresh(true);
    const timer = period === "today" ? window.setInterval(() => void refresh(false), 15_000) : null;
    return () => { active = false; if (timer) window.clearInterval(timer); };
  }, [period, selectedDate]);

  async function loadOlder() {
    if (!nextBefore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const params = new URLSearchParams({ period, before: nextBefore });
      if (period === "date") params.set("date", selectedDate);
      const response = await fetch(`/api/admin/assistant?${params}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar mensagens anteriores.");
      setMessages((current) => [...new Map([...(body.messages || []), ...current].map((item: ChatMessage) => [item.id, item])).values()]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setNextBefore(body.nextBefore || null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar mensagens anteriores."); }
    finally { setLoadingOlder(false); }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, proposal]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim() || (image ? "Analise esta imagem e me diga o que encontrou." : "");
    if (!text || busy) return;
    operationVersion.current++;
    setInput(""); setError(""); setBusy(true); setProposal(null);
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: "user", text, createdAt: new Date().toISOString(), previewUrl: imagePreview, imageName: image?.name };
    const acknowledgement: ChatMessage = { id: `ack-${Date.now()}`, role: "assistant", text: assistantAcknowledgement(text), createdAt: new Date().toISOString() };
    setMessages((current) => [...current, optimistic, acknowledgement]);
    try {
      const payload = new FormData();
      payload.set("type", "message"); payload.set("message", text);
      if (image) payload.set("image", image);
      const response = await fetch("/api/admin/assistant", { method: "POST", body: payload });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não consegui responder agora.");
      setMessages((current) => [...current.filter((item) => item.id !== acknowledgement.id && item.id !== optimistic.id), body.userMessage || optimistic, body.message].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index));
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setProposal(body.proposal || null);
      if (period !== "today") setPeriod("today");
    } catch (cause) {
      setMessages((current) => current.filter((item) => item.id !== acknowledgement.id && item.id !== optimistic.id));
      setInput(text === "Analise esta imagem e me diga o que encontrou." && image ? "" : text);
      setError(cause instanceof TypeError ? "Conexão interrompida. Seu pedido foi preservado; confira o histórico antes de reenviar." : cause instanceof Error ? cause.message : "Falha ao enviar o pedido.");
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!proposal || busy) return;
    operationVersion.current++;
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/admin/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "confirm", proposalId: proposal.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível confirmar a alteração.");
      setMessages((current) => [...current, body.message]);
      setProposal(null);
    } catch (cause) {
      setError(cause instanceof TypeError ? "Conexão interrompida. Atualize a conversa e confira o resultado antes de tentar novamente." : cause instanceof Error ? cause.message : "Falha ao confirmar a alteração.");
    } finally { setBusy(false); }
  }

  async function discard() {
    if (!proposal || busy) return;
    const proposalId = proposal.id;
    operationVersion.current++;
    setBusy(true);
    setProposal(null);
    try {
      const response = await fetch("/api/admin/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "discard", proposalId }) });
      if (!response.ok) throw new Error("Cancelamento não confirmado.");
    } catch { setProposal(proposal); setError("Não foi possível cancelar a proposta. Atualize a página para conferir."); }
    finally { setBusy(false); }
  }

  return (
    <div className={styles.layout}>
      <section className={styles.chat} aria-label="Conversa com o Assistente IA">
        <header className={styles.chatHeader}><span className={styles.avatar} aria-hidden="true">✦</span><div className={styles.headerTitle}><span className={styles.headerEyebrow}>Central de operação · TCR Ingressos</span><strong>Assistente IA</strong><small>Converse sobre seus eventos e ingressos</small></div><span className={styles.headerBadge}>Nenhuma mudança sem confirmação</span></header>
        <div className={styles.historyFilter}><span>Histórico compartilhado da equipe</span><label htmlFor="assistant-period">Período</label><select id="assistant-period" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="today">Hoje</option><option value="yesterday">Ontem</option><option value="last7">Últimos 7 dias</option><option value="date">Escolher data</option><option value="all">Todo o histórico</option></select>{period === "date" ? <input type="date" aria-label="Data da conversa" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /> : null}</div>
        <div className={styles.messages} aria-live="polite">
          {nextBefore ? <button type="button" className={styles.olderButton} onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? "Carregando..." : "Carregar mensagens anteriores"}</button> : null}
          {!loading && messages.length === 0 ? <div className={styles.welcome}><span aria-hidden="true">✦</span><h2>Como posso ajudar, {name.split(" ")[0]}?</h2><p>Escreva o que precisa em linguagem natural. Posso consultar os dados e, quando houver uma mudança disponível, mostrar uma proposta para você revisar.</p></div> : null}
          {messages.map((message) => <article key={message.id} className={`${styles.bubble} ${message.role === "user" ? styles.user : styles.assistant}`}>{message.role === "user" && message.authorName ? <small className={styles.authorName}>{message.authorName}</small> : null}<p>{message.text}</p>{message.imageId || message.previewUrl ? <img className={styles.messageImage} src={message.previewUrl || `/api/admin/assistant?imageId=${encodeURIComponent(message.imageId || "")}`} alt={message.imageName || "Imagem anexada"} loading="lazy" /> : null}<time>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></article>)}
          {busy ? <div className={styles.thinking}>Consultando as informações do sistema...</div> : null}
          {proposal?.kind === "EVENT_IMPORT_SETUP" ? <ImportReview key={proposal.id} proposal={proposal} disabled={busy} onWorking={setBusy} onPrepared={(next) => { operationVersion.current++; setProposal(next); }} onCancel={discard} /> : null}
          {proposal && proposal.kind !== "EVENT_IMPORT_SETUP" ? <section className={styles.proposal}><span className={styles.proposalLabel}>Alteração aguardando confirmação</span><h3>{proposal.eventTitle}</h3>{proposal.kind === "EVENT_IMPORT" ? <ImportSummary plan={proposal.plan} /> : proposal.kind === "PRICE_CHANGE" ? <><p>{proposal.lotName}</p><div className={styles.priceChange}><span>{money(proposal.oldPriceInCents)}</span><b>→</b><strong>{money(proposal.newPriceInCents)}</strong></div></> : proposal.kind === "EVENT_CREATE" ? <><p>Novo evento em rascunho — não ficará público</p><p>{proposal.draft.city}/{proposal.draft.state} · {new Date(proposal.draft.startsAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p><p>{proposal.draft.venueName} · {proposal.draft.venueAddress}</p><small>Endereço: /evento/{proposal.draft.slug} · Banner: {proposal.draft.bannerUrl ? "URL incluída" : "pendente"} · Mapa: {proposal.draft.eventMapImageUrl ? "URL incluída" : "pendente"}</small></> : proposal.kind === "EVENT_STATUS_CHANGE" ? <><p>Status do evento</p><div className={styles.priceChange}><span>{proposal.oldStatus === "PUBLISHED" ? "No ar" : "Inativo"}</span><b>→</b><strong>{proposal.newStatus === "PUBLISHED" ? "No ar" : "Inativo (fora do ar)"}</strong></div></> : proposal.kind === "LOT_ORDER_CHANGE" ? <><p>Nova ordem de exibição:</p><ol>{proposal.orderedNames.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}</ol></> : proposal.kind === "EVENT_DETAILS_CHANGE" ? proposal.changes.map((change, index) => <div key={index}><p>{eventFieldLabels[change.field] || change.field}</p><div className={styles.priceChange}><span>{proposalValue(change.oldValue, change.field)}</span><b>→</b><strong>{proposalValue(change.value, change.field)}</strong></div>{change.value.startsWith("assistant-image:") ? <img className={styles.messageImage} src={`/api/admin/assistant?imageId=${encodeURIComponent(change.value.slice("assistant-image:".length))}`} alt={`Prévia: ${eventFieldLabels[change.field] || change.field}`} /> : null}</div>) : proposal.changes.map((change, index) => <div key={index}><p>{change.operation === "CREATE" ? "Criar ingresso" : `Alterar ${change.oldName}`}</p><strong>{change.name}</strong><p>{change.description}</p><div className={styles.priceChange}><span>{change.operation === "CREATE" ? "Novo" : money(change.oldPriceInCents)}</span><b>→</b><strong>{money(change.priceInCents)}</strong></div><small>Estoque: {change.totalQuantity} · Status: {change.status}</small>{change.serviceFeeBps !== undefined ? <p>Taxa de bilheteria: {change.oldServiceFeeBps !== undefined ? `${change.oldServiceFeeBps / 100}% → ` : ""}{change.serviceFeeBps / 100}%</p> : null}{change.cardInterestBpsPerInstallment !== undefined ? <p>Cartão: {change.cardInterestBpsPerInstallment / 100}% por parcela, a partir da {change.cardInterestStartsAtInstallment}ª parcela</p> : null}{change.highlightColor ? <p>Cor de destaque: {change.oldHighlightColor || "sem cor"} → <strong>{change.highlightColor}</strong></p> : null}</div>)}<div className={styles.proposalActions}><button type="button" onClick={confirm} disabled={busy}>Confirmar alteração</button><button type="button" onClick={discard} disabled={busy}>Cancelar</button></div></section> : null}
          <div ref={bottomRef} />
        </div>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <form className={styles.composer} onSubmit={send}><input ref={fileInputRef} className={styles.srOnly} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} aria-label="Selecionar imagem ou print" disabled={busy} /><button className={styles.attachButton} type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} aria-label="Anexar imagem ou print">＋</button><label className={styles.srOnly} htmlFor="assistant-prompt">Escreva sua solicitação</label><div className={styles.composerField}>{image ? <div className={styles.selectedImage}><img src={imagePreview} alt="Prévia do print selecionado" /><span>{image.name}</span><button type="button" onClick={() => { setImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} aria-label="Remover imagem">×</button></div> : null}<textarea id="assistant-prompt" rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Escreva sua pergunta ou solicitação..." maxLength={2000} disabled={busy} /><small>Enter para enviar · Shift + Enter para pular linha · JPG/PNG/WEBP até 2 MB</small></div><button type="submit" disabled={(!input.trim() && !image) || busy}>Enviar <span aria-hidden="true">↗</span></button></form>
      </section>
    </div>
  );
}
