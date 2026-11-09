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
        <header className={styles.chatHeader}><span className={styles.avatar}>✦</span><div><strong>Assistente IA da TCR</strong><small>Consultas reais e alterações com sua confirmação</small></div></header>
        <div className={styles.messages} aria-live="polite">
          {!loading && messages.length === 0 ? <div className={styles.welcome}><span>✦</span><h2>Como posso ajudar, {name.split(" ")[0]}?</h2><p>Descreva a alteração ou envie o link de um evento antigo. Vou conferir os dados antes de propor qualquer ação.</p></div> : null}
          {messages.map((message) => <article key={message.id} className={`${styles.bubble} ${message.role === "user" ? styles.user : styles.assistant}`}><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></article>)}
          {busy ? <div className={styles.thinking}>Conferindo os dados...</div> : null}
          {proposal ? <section className={styles.proposal}><span className={styles.proposalLabel}>Alteração aguardando confirmação</span><h3>{proposal.eventTitle}</h3><p>{proposal.lotName}</p><div className={styles.priceChange}><span>{money(proposal.oldPriceInCents)}</span><b>→</b><strong>{money(proposal.newPriceInCents)}</strong></div><div className={styles.proposalActions}><button type="button" onClick={confirm} disabled={busy}>Confirmar alteração</button><button type="button" onClick={discard} disabled={busy}>Cancelar</button></div></section> : null}
          <div ref={bottomRef} />
        </div>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <form className={styles.composer} onSubmit={send}><label className={styles.srOnly} htmlFor="assistant-prompt">Escreva sua solicitação</label><textarea id="assistant-prompt" rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ex.: Altere o Ouro Meia do evento de Sorocaba para R$ 157,90" maxLength={2000} disabled={busy} /><button type="submit" disabled={!input.trim() || busy}>Enviar</button></form>
      </section>
      <aside className={styles.help}><span className={styles.eyebrow}>Comece por aqui</span><h2>Peça como você pediria a um colega</h2><p>O assistente consulta os eventos da sua bilheteria. Mudanças de preço aparecem primeiro como proposta; nada é alterado só por enviar uma mensagem.</p><div className={styles.example}><strong>Consultar</strong><span>“Quais ingressos estão ativos no evento de Sorocaba?”</span></div><div className={styles.example}><strong>Alterar preço</strong><span>“Mude o Ouro Meia de Sorocaba para R$ 157,90.”</span></div><div className={styles.example}><strong>Analisar link</strong><span>“Confira este link do site antigo e me diga os dados do evento.”</span></div><p className={styles.note}>Criação completa por link, mapas e outras alterações ainda não são executadas automaticamente nesta primeira versão. O assistente deve informar isso claramente.</p></aside>
    </div>
  );
}
