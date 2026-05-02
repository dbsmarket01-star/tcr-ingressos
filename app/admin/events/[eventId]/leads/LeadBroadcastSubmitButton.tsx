"use client";

import { useFormStatus } from "react-dom";

export function LeadBroadcastSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button leadBroadcastSubmitButton" type="submit" disabled={pending}>
      {pending ? (
        <>
          <span className="buttonSpinner" aria-hidden="true" />
          Enviando e-mails...
        </>
      ) : (
        "Enviar e-mail"
      )}
    </button>
  );
}
