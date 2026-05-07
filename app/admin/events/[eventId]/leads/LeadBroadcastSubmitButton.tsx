"use client";

import { useFormStatus } from "react-dom";

type LeadBroadcastSubmitButtonProps = {
  disabledExternally?: boolean;
};

export function LeadBroadcastSubmitButton({ disabledExternally = false }: LeadBroadcastSubmitButtonProps) {
  const { pending } = useFormStatus();
  const disabled = pending || disabledExternally;

  return (
    <button className="button leadBroadcastSubmitButton" type="submit" disabled={disabled}>
      {pending ? (
        <>
          <span className="buttonSpinner" aria-hidden="true" />
          Enviando e-mails...
        </>
      ) : disabledExternally ? (
        "Campanha em andamento"
      ) : (
        "Enviar e-mail"
      )}
    </button>
  );
}
