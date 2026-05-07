"use client";

type LeadBroadcastDestinationHelperProps = {
  eventGroupUrl: string;
};

export function LeadBroadcastDestinationHelper({ eventGroupUrl }: LeadBroadcastDestinationHelperProps) {
  function setDestinationUrl(value: string) {
    const input = document.querySelector<HTMLInputElement>('input[name="destinationUrl"]');

    if (!input) {
      return;
    }

    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div className="destinationHelperRow">
      <button
        className="secondaryButton smallButton"
        onClick={() => setDestinationUrl(eventGroupUrl)}
        type="button"
      >
        Usar link do grupo do evento
      </button>
      <button
        className="ghostButton smallButton"
        onClick={() => setDestinationUrl("")}
        type="button"
      >
        Limpar link
      </button>
      <small className="muted">
        O link digitado em <strong>Link de destino</strong> sempre prevalece no envio. Se deixar em branco, o sistema usa o grupo salvo no evento.
      </small>
    </div>
  );
}
