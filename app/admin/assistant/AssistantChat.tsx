"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function useExample(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

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
    setMessages((current) => [...current, optimistic]);
    try {
      const response = await fetch("/api/admin/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "message", message: text }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não consegui responder agora.");
      setMessages((current) => [...current, body.message]);
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
        <header className={styles.chatHeader}><span className={styles.avatar} aria-hidden="true">✦</span><div className={styles.headerTitle}><span className={styles.headerEyebrow}>Central de operação · TCR Ingressos</span><strong>Assistente IA</strong><small>Consulte eventos e revise propostas antes de confirmar</small></div><span className={styles.headerBadge}>Alterações com confirmação</span></header>
        <div className={styles.messages} aria-live="polite">
          {!loading && messages.length === 0 ? <div className={styles.welcome}><span aria-hidden="true">✦</span><h2>Como posso ajudar, {name.split(" ")[0]}?</h2><p>Descreva a alteração ou envie o link de um evento antigo. Vou conferir os dados antes de propor qualquer ação.</p></div> : null}
          {messages.map((message) => <article key={message.id} className={`${styles.bubble} ${message.role === "user" ? styles.user : styles.assistant}`}><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></article>)}
          {busy ? <div className={styles.thinking}>Conferindo os dados...</div> : null}
          {proposal ? <section className={styles.proposal}><span className={styles.proposalLabel}>Alteração aguardando confirmação</span><h3>{proposal.eventTitle}</h3><p>{proposal.lotName}</p><div className={styles.priceChange}><span>{money(proposal.oldPriceInCents)}</span><b>→</b><strong>{money(proposal.newPriceInCents)}</strong></div><div className={styles.proposalActions}><button type="button" onClick={confirm} disabled={busy}>Confirmar alteração</button><button type="button" onClick={discard} disabled={busy}>Cancelar</button></div></section> : null}
          <div ref={bottomRef} />
        </div>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <form className={styles.composer} onSubmit={send}><label className={styles.srOnly} htmlFor="assistant-prompt">Escreva sua solicitação</label><div className={styles.composerField}><textarea ref={inputRef} id="assistant-prompt" rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Peça uma consulta ou alteração de ingresso..." maxLength={2000} disabled={busy} /><small>Enter para enviar · Shift + Enter para pular linha</small></div><button type="submit" disabled={!input.trim() || busy}>Enviar <span aria-hidden="true">↗</span></button></form>
      </section>
      <aside className={styles.help}><span className={styles.eyebrow}>Sua área de trabalho</span><h2>O que você pode pedir</h2><p>Escolha um exemplo para levar o texto ao chat ou escreva com suas palavras.</p><button type="button" className={styles.example} onClick={() => useExample("Quais ingressos estão ativos no evento Rodrigo Teaser em Sorocaba?")}><span className={styles.exampleIcon} aria-hidden="true">⌕</span><span><strong>Consultar ingressos</strong><small>Veja categorias, preços e disponibilidade.</small></span><span className={styles.exampleArrow} aria-hidden="true">↗</span></button><button type="button" className={styles.example} onClick={() => useExample("Mude o preço do ingresso Ouro Meia do evento Rodrigo Teaser em Sorocaba para R$ 157,90.")}><span className={styles.exampleIcon} aria-hidden="true">R$</span><span><strong>Alterar preço</strong><small>Confira a proposta antes de salvar.</small></span><span className={styles.exampleArrow} aria-hidden="true">↗</span></button><button type="button" className={styles.example} onClick={() => useExample("Confira este link do site antigo e me diga os dados do evento: ")}><span className={styles.exampleIcon} aria-hidden="true">↗</span><span><strong>Analisar link</strong><small>Cole o endereço público do evento antigo.</small></span><span className={styles.exampleArrow} aria-hidden="true">↗</span></button><div className={styles.note}><strong>Antes de executar</strong><p>O assistente só salva uma mudança de preço após sua confirmação. Criação de eventos, mapas e outras alterações ainda não são automáticas.</p></div></aside>
    </div>
  );
}
