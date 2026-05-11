"use client";

import { useState } from "react";

export function FeeExplanationButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className="checkoutFeeHint" type="button" onClick={() => setIsOpen(true)}>
        ⓘ Entenda nossa taxa
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
            <h3 id="fee-explanation-title">Entenda nossa taxa</h3>
            <p>
              Taxas referentes ao sistema que gera os ingressos e protege seus dados bancários e pessoais ao realizar a compra.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
