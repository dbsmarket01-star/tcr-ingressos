"use client";

import { useRef, useState } from "react";
import { sendCrmWhatsAppMessage } from "@/features/crm/whatsapp-chat.actions";
import { WhatsAppSendButton } from "./WhatsAppSendButton";

type WhatsAppComposerProps = {
  canReply: boolean;
  leadId: string;
  orderCode: string;
  phone: string;
};

function ComposerIcon({ name }: { name: "smile" | "clip" | "plus" | "mic" }) {
  if (name === "mic") return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>;
  if (name === "plus") return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "clip") return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="m9 13 5.8-5.8a3 3 0 1 1 4.2 4.2l-7.5 7.5a5 5 0 0 1-7.1-7.1l7.1-7.1" /></svg>;
  return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>;
}

export function WhatsAppComposer({ canReply, leadId, orderCode, phone }: WhatsAppComposerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [optimisticText, setOptimisticText] = useState("");
  const [selectedFile, setSelectedFile] = useState("");

  async function submit(formData: FormData) {
    const text = String(formData.get("text") || "").trim();
    const file = [formData.get("media"), formData.get("audio")].find((value) => value instanceof File && value.size > 0) as File | undefined;
    if (!text && !file) return;
    setOptimisticText(text || `Enviando ${file?.name || "arquivo"}…`);
    formRef.current?.reset();
    setSelectedFile("");
    await sendCrmWhatsAppMessage(formData);
  }

  return <>
    {optimisticText ? <div aria-live="polite" style={{ background: "#f7f8f5", display: "grid", padding: "8px 22px" }}><article className="crmWhatsappBubble isOutbound"><p>{optimisticText}</p><footer><time>Enviando…</time></footer></article></div> : null}
    <form action={submit} className="crmWhatsappComposer" ref={formRef}>
      <input name="orderCode" type="hidden" value={orderCode}/>
      <input name="leadId" type="hidden" value={leadId}/>
      <input name="phone" type="hidden" value={phone}/>
      <input accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,audio/*" className="crmWhatsappFileInput" disabled={!canReply || !phone} name="media" onChange={(event) => setSelectedFile(event.target.files?.[0]?.name || "")} ref={mediaInputRef} type="file"/>
      <input accept="audio/*" capture="user" className="crmWhatsappFileInput" disabled={!canReply || !phone} name="audio" onChange={(event) => setSelectedFile(event.target.files?.[0]?.name || "Áudio selecionado")} ref={audioInputRef} type="file"/>
      <span className="crmWhatsappComposerIcon" title="Use o teclado do dispositivo para emojis"><ComposerIcon name="smile"/></span>
      <button aria-label="Anexar foto, vídeo, PDF ou arquivo" className="crmWhatsappComposerIcon" disabled={!canReply || !phone} onClick={() => mediaInputRef.current?.click()} title="Anexar foto, vídeo, áudio, PDF ou arquivo" type="button"><ComposerIcon name="clip"/></button>
      <button aria-label="Gravar ou anexar áudio" className="crmWhatsappComposerIcon" disabled={!canReply || !phone} onClick={() => audioInputRef.current?.click()} title="Gravar ou anexar áudio" type="button"><ComposerIcon name="mic"/></button>
      <label className="crmWhatsappComposerText"><textarea name="text" placeholder={canReply ? "Escreva uma resposta..." : "Aguardando o cliente responder para abrir a janela de 24h"} disabled={!canReply || !phone} rows={1}/>{selectedFile ? <small title={selectedFile}>📎 {selectedFile}</small> : null}</label>
      <WhatsAppSendButton disabled={!canReply || !phone}/>
    </form>
  </>;
}
