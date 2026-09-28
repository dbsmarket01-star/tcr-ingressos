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

function ComposerIcon({ name }: { name: "smile" | "clip" | "plus" }) {
  if (name === "plus") return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "clip") return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="m9 13 5.8-5.8a3 3 0 1 1 4.2 4.2l-7.5 7.5a5 5 0 0 1-7.1-7.1l7.1-7.1" /></svg>;
  return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>;
}

export function WhatsAppComposer({ canReply, leadId, orderCode, phone }: WhatsAppComposerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [optimisticText, setOptimisticText] = useState("");

  async function submit(formData: FormData) {
    const text = String(formData.get("text") || "").trim();
    if (!text) return;
    setOptimisticText(text);
    formRef.current?.reset();
    await sendCrmWhatsAppMessage(formData);
  }

  return <>
    {optimisticText ? <div aria-live="polite" style={{ background: "#f7f8f5", display: "grid", padding: "8px 22px" }}><article className="crmWhatsappBubble isOutbound"><p>{optimisticText}</p><footer><time>Enviando…</time></footer></article></div> : null}
    <form action={submit} className="crmWhatsappComposer" ref={formRef}>
      <input name="orderCode" type="hidden" value={orderCode}/>
      <input name="leadId" type="hidden" value={leadId}/>
      <input name="phone" type="hidden" value={phone}/>
      <span className="crmWhatsappComposerIcon" title="Use o teclado do dispositivo para emojis"><ComposerIcon name="smile"/></span>
      <span className="crmWhatsappComposerIcon isDisabled" title="Arquivos não são suportados pela integração atual"><ComposerIcon name="clip"/></span>
      <span className="crmWhatsappComposerIcon"><ComposerIcon name="plus"/></span>
      <textarea name="text" placeholder={canReply ? "Escreva uma resposta..." : "Aguardando o cliente responder para abrir a janela de 24h"} disabled={!canReply || !phone} rows={1}/>
      <WhatsAppSendButton disabled={!canReply || !phone}/>
    </form>
  </>;
}
