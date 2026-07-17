"use client";

import { useState } from "react";

type FeeExplanationButtonProps = {
  variant?: "link" | "icon";
};

const feeExplanationText =
  "As taxas aplicadas à compra referem-se aos serviços do sistema responsável pelo processamento do pagamento, geração e separação do pedido, além da proteção dos seus dados pessoais e bancários contra fraudes.";

export function FeeExplanationButton({ variant = "link" }: FeeExplanationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Entenda as taxas aplicadas"
        className={variant === "icon" ? "checkoutFeeInfoButton" : "checkoutFeeHint"}
        type="button"
        onClick={() => setIsOpen(true)}
      >
        {variant === "icon" ? "i" : "ⓘ Entenda nossa taxa"}
      </button>
      {isOpen ? (
        <div className="feeExplanationBackdrop" role="presentation" onClick={() => setIsOpen(false)}>
          <div
            aria-modal="true"
            className="feeExplanationDialog"
            role="dialog"
            aria-labelledby="fee-explanation-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="feeExplanationClose" type="button" aria-label="Fechar" onClick={() => setIsOpen(false)}>
              ×
            </button>
            <h3 id="fee-explanation-title">Informação!</h3>
            <p>{feeExplanationText}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
