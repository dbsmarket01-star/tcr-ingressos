export function getCheckInFeedback(status: "ALREADY_USED" | "CANCELED" | "INVALID") {
  switch (status) {
    case "ALREADY_USED":
      return "Este ingresso já teve a entrada registrada. Não libere outra entrada; confira o horário da primeira validação.";
    case "CANCELED":
      return "Este ingresso foi cancelado. Não libere a entrada; encaminhe ao suporte.";
    case "INVALID":
      return "Este ingresso está invalidado. Não libere a entrada; encaminhe ao suporte.";
  }
}

export function getUnknownCodeFeedback(code: string) {
  return /^ING-[A-F0-9]{16}$/i.test(code)
    ? "Código de ingresso não encontrado neste evento. Confira o código e o evento selecionado; não libere a entrada."
    : "QR Code não reconhecido como ingresso da TCR. Pode ser de outro serviço ou estar ilegível. Confira o código impresso abaixo do QR; não libere a entrada.";
}

export const wrongEventFeedback =
  "Este ingresso pertence a outro evento. Selecione o evento correto no painel; não libere a entrada aqui.";
