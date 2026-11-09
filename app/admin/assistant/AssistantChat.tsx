"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { assistantAcknowledgement } from "@/features/assistant/assistant-request";
import styles from "./assistant.module.css";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string; createdAt: string };
type Proposal = { id: string; eventTitle: string; lotName: string; oldPriceInCents: number; newPriceInCents: number };

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AssistantChat({ name }: { name: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/assistant", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Não foi possível carregar a conversa.");
        setMessages(body.messages || []);
        setProposal(body.proposal || null);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao carregar a conversa."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, proposal]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput(""); setError(""); setBusy(true); setProposal(null);
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: "user", text, createdAt: new Date().toISOString() };
    const acknowledgement: ChatMessage = { id: `ack-${Date.now()}`, role: "assistant", text: assistantAcknowledgement(text), createdAt: new Date().toISOString() };
    setMessages((current) => [...current, optimistic, acknowledgement]);
    try {
      const response = await fetch("/api/admin/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "message", message: text }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não consegui responder agora.");
      setMessages((current) => [...current.filter((item) => item.id !== acknowledgement.id), body.message]);
      setProposal(body.proposal || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao enviar o pedido.");
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!proposal || busy) return;
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/admin/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "confirm", proposalId: proposal.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível confirmar a alteração.");
      setMessages((current) => [...current, body.message]);
      setProposal(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao confirmar a alteração.");
    } finally { setBusy(false); }
  }

  async function discard() {
    if (!proposal || busy) return;
    const proposalId = proposal.id;
    setProposal(null);
    try {
      await fetch("/api/admin/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "discard", proposalId }) });
    } catch { setError("Não foi possível cancelar a proposta. Atualize a página para conferir."); }
  }

  return (
    <div className={styles.layout}>
      <section className={styles.chat} aria-label="Conversa com o Assistente IA">
        <header className={styles.chatHeader}><span className={styles.avatar} aria-hidden="true">✦</span><div className={styles.headerTitle}><span className={styles.headerEyebrow}>Central de operação · TCR Ingressos</span><strong>Assistente IA</strong><small>Converse sobre seus eventos e ingressos</small></div><span className={styles.headerBadge}>Nenhuma mudança sem confirmação</span></header>
        <div className={styles.messages} aria-live="polite">
          {!loading && messages.length === 0 ? <div className={styles.welcome}><span aria-hidden="true">✦</span><h2>Como posso ajudar, {name.split(" ")[0]}?</h2><p>Escreva o que precisa em linguagem natural. Posso consultar os dados e, quando houver uma mudança disponível, mostrar uma proposta para você revisar.</p></div> : null}
          {messages.map((message) => <article key={message.id} className={`${styles.bubble} ${message.role === "user" ? styles.user : styles.assistant}`}><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></article>)}
          {busy ? <div className={styles.thinking}>Consultando as informações do sistema...</div> : null}
          {proposal ? <section className={styles.proposal}><span className={styles.proposalLabel}>Alteração aguardando confirmação</span><h3>{proposal.eventTitle}</h3><p>{proposal.lotName}</p><div className={styles.priceChange}><span>{money(proposal.oldPriceInCents)}</span><b>→</b><strong>{money(proposal.newPriceInCents)}</strong></div><div className={styles.proposalActions}><button type="button" onClick={confirm} disabled={busy}>Confirmar alteração</button><button type="button" onClick={discard} disabled={busy}>Cancelar</button></div></section> : null}
          <div ref={bottomRef} />
        </div>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <form className={styles.composer} onSubmit={send}><label className={styles.srOnly} htmlFor="assistant-prompt">Escreva sua solicitação</label><div className={styles.composerField}><textarea id="assistant-prompt" rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Escreva sua pergunta ou solicitação..." maxLength={2000} disabled={busy} /><small>Enter para enviar · Shift + Enter para pular linha</small></div><button type="submit" disabled={!input.trim() || busy}>Enviar <span aria-hidden="true">↗</span></button></form>
      </section>
    </div>
  );
}
