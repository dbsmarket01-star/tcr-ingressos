"use client";

import { useFormStatus } from "react-dom";

export function WhatsAppSendButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      aria-busy={pending}
      aria-label={pending ? "Enviando mensagem" : "Enviar mensagem"}
      className="crmWhatsappSend"
      disabled={isDisabled}
      type="submit"
    >
      {pending ? (
        <span className="buttonSpinner" aria-hidden="true" />
      ) : (
        <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 11 18-8-8 18-2-8-8-2Zm8 2 4-4" />
        </svg>
      )}
    </button>
  );
}
