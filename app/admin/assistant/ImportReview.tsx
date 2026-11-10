"use client";
import { useState, type FormEvent } from "react";
import type { ImportPlan, ImportProposal, ImportSource } from "@/features/assistant/assistant-event-import";
import styles from "./import-review.module.css";
const money = (n: number) => (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ImportSummary({ plan }: { plan: ImportPlan }) {
  return <div className={styles.review}><p><a href={plan.source.url} target="_blank" rel="noreferrer">Referência consultada</a></p>
    <p><strong>{plan.source.title}</strong><br />{new Date(plan.startsAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · Brasília<br />{plan.venueName} — {plan.venueAddress}<br />{plan.city}/{plan.state}</p>
    <div className={styles.media}>{plan.source.bannerUrl && <img src={plan.source.bannerUrl} alt="Banner da fonte" />}{plan.source.mapUrl && <img src={plan.source.mapUrl} alt="Mapa da fonte" />}</div>
    <details><summary>Descrição do evento</summary><p className={styles.description}>{plan.source.description}</p></details>
    <p>Taxa de bilheteria: {plan.serviceFeeBps / 100}%. Juros configurados: {plan.cardInterestBpsPerInstallment / 100}% desde a {plan.cardInterestStartsAtInstallment}ª parcela. Limite por pedido: {plan.minPerOrder} a {plan.maxPerOrder}. Sem desconto adicional configurado. Vendas até o início do evento.</p>
    {plan.source.tickets.map((ticket, index) => <article key={ticket.infoId || index}><strong>{ticket.name}</strong><p>{money(plan.tickets[index].priceInCents)} · {plan.tickets[index].quantity} unidades · {plan.tickets[index].admissionsPerUnit} pessoa(s) por unidade</p>{plan.tickets[index].options.length > 0 && <p>Unidades numeradas: {plan.tickets[index].options.join(", ")}. Compra de uma unidade numerada por pedido.</p>}<details><summary>Descrição do ingresso</summary><p className={styles.description}>{plan.tickets[index].description || "Sem descrição — revisado pelo operador."}</p></details></article>)}
    <strong>{plan.publish ? "Após confirmar: publicar evento e ingressos no site." : "Após confirmar: salvar como rascunho, fora do site público."}</strong>
  </div>;
}
export function ImportReview({ proposal, onPrepared, onCancel, onWorking, disabled }: { proposal: Extract<ImportProposal, { kind: "EVENT_IMPORT_SETUP" }>; onPrepared: (proposal: ImportProposal) => void; onCancel: () => void; onWorking: (working: boolean) => void; disabled: boolean }) {
  const source: ImportSource = proposal.source;
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || disabled) return; const data = new FormData(event.currentTarget); setBusy(true); onWorking(true); setError("");
    const value = (key: string) => String(data.get(key) || "");
    const number = (key: string) => value(key) === "" ? null : Number(value(key).replace(",", "."));
    const bps = (key: string) => number(key) === null ? null : Math.round(number(key)! * 100);
    const settings = { startsAt: `${value("startsAt")}:00-03:00`, city: value("city"), state: value("state").toUpperCase(), venueName: value("venueName"), venueAddress: value("venueAddress"),
      publish: value("publish") === "true", noMapConfirmed: data.has("noMapConfirmed"), reviewed: data.has("reviewed"),
      serviceFeeBps: bps("fee"), cardInterestBpsPerInstallment: bps("interest"), cardInterestStartsAtInstallment: number("installment"),
      minPerOrder: number("min"), maxPerOrder: number("max"),
      tickets: source.tickets.map((ticket, index) => ({ quantity: number(`quantity${index}`), admissionsPerUnit: number(`admissions${index}`),
        priceInCents: ticket.priceIsMinimum ? Math.round((number(`price${index}`) || 0) * 100) : ticket.priceInCents,
        options: value(`options${index}`).split(/[\n;]/).map(v => v.trim()).filter(Boolean), description: value(`description${index}`), descriptionReviewed: data.has(`descriptionReviewed${index}`) })) };
    try {
      const response = await fetch("/api/admin/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "prepareImport", proposalId: proposal.id, settings }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível revisar a importação.");
      onPrepared(result.proposal);
    } catch (cause) { setError(cause instanceof TypeError ? "Conexão interrompida. Seus campos foram preservados; confira o histórico antes de repetir." : cause instanceof Error ? cause.message : "Não foi possível revisar a proposta."); }
    finally { setBusy(false); onWorking(false); }
  }
  return <form onSubmit={submit} className={styles.review} aria-label="Revisão da importação"><h3>Revisar importação — {source.title}</h3>
    <a href={source.url} target="_blank" rel="noreferrer">Abrir referência</a><p>Nenhum evento foi criado. Confira os dados extraídos e complete as lacunas.</p>
    <ul>{source.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
    <div className={styles.media}>{source.bannerUrl && <img src={source.bannerUrl} alt="Banner da fonte" />}{source.mapUrl && <img src={source.mapUrl} alt="Mapa da fonte" />}</div>
    {!source.bannerUrl && <p role="alert">Banner ausente na fonte. Importação bloqueada; providencie a mídia na referência.</p>}
    {!source.mapUrl && <label><input type="checkbox" name="noMapConfirmed" required /> Confirmo que este evento não usa mapa.</label>}
    <details><summary>Descrição extraída do evento</summary><p className={styles.description}>{source.description || "Não disponível na referência — importação bloqueada."}</p></details>
    <p>Data informada na fonte: <strong>{source.dateText || "Não encontrada"}</strong></p>
    <div className={styles.grid}>
      <label>Data completa e horário (Brasília)<input name="startsAt" type="datetime-local" required /></label>
      <label>Cidade<input name="city" defaultValue={source.city} required /></label><label>UF<input name="state" defaultValue={source.state} maxLength={2} required /></label>
      <label>Local<input name="venueName" defaultValue={source.venueName} required /></label><label>Endereço<input name="venueAddress" defaultValue={source.venueAddress} required /></label>
      <label>Taxa de bilheteria (%)<input name="fee" type="number" min="0" max="30" step="0.01" required /></label>
      <label>Juros por parcela (%)<input name="interest" type="number" min="0" max="10" step="0.01" required /></label>
      <label>Aplicar juros desde a parcela<input name="installment" type="number" min="1" max="12" required /></label>
      <label>Mínimo por pedido<input name="min" type="number" min="1" max="100" required /></label><label>Máximo por pedido<input name="max" type="number" min="1" max="100" required /></label>
    </div>
    {source.tickets.map((ticket, index) => <fieldset key={ticket.infoId || index}><legend>{ticket.name} — {money(ticket.priceInCents)}{ticket.priceIsMinimum ? " (a partir de)" : ""}</legend>
      <div className={styles.grid}><label>Estoque em unidades<input name={`quantity${index}`} type="number" min="1" required /></label>
      <label>Pessoas por unidade<input name={`admissions${index}`} type="number" min="1" max="100" defaultValue={ticket.admissionsPerUnit} required /></label>
      {ticket.priceIsMinimum && <label>Preço exato por unidade (R$)<input name={`price${index}`} type="number" min="10" step="0.01" required /></label>}</div>
      {ticket.needsOptions && <label>Numeração disponível, uma unidade por linha<textarea name={`options${index}`} required placeholder="Ex.: Camarote 17" /><small>O estoque deve ser igual à quantidade de unidades numeradas. Se houver preços diferentes entre unidades, use o cadastro completo.</small></label>}
      <label>Descrição do ingresso<textarea name={`description${index}`} defaultValue={ticket.description} maxLength={4000} /></label>
      <label><input type="checkbox" name={`descriptionReviewed${index}`} required /> Conferi a descrição e as condições deste ingresso{ticket.description ? "." : " (ausentes na fonte)."}</label>
    </fieldset>)}
    <label>Após a confirmação<select name="publish" defaultValue="true"><option value="true">Publicar no site</option><option value="false">Salvar somente rascunho</option></select></label>
    <label><input type="checkbox" name="reviewed" required /> Revisei os dados, preços, capacidades e numeração. Autorizo as condições informadas, sem desconto adicional, com vendas até o início do evento.</label>
    {error && <p role="alert">{error}</p>}<div className={styles.actions}><button disabled={disabled || busy || !source.bannerUrl || !source.description} type="submit">{busy ? "Conferindo..." : "Revisar proposta de importação"}</button><button type="button" disabled={disabled || busy} onClick={onCancel}>Cancelar importação</button></div>
  </form>;
}
