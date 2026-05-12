"use client";

import { useEffect, useRef, useState } from "react";

function readSelectedQuantity() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="quantity_"]')).reduce(
    (sum, input) => sum + Math.max(Number(input.value || 0), 0),
    0
  );
}

export function AddToCartButton() {
  const [selectedQuantity, setSelectedQuantity] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="quantity_"]'));
    const form = buttonRef.current?.form;

    function updateSelectedQuantity() {
      setSelectedQuantity(readSelectedQuantity());
    }

    function handleSubmit() {
      if (readSelectedQuantity() > 0) {
        setSubmitting(true);
      }
    }

    function resetSubmitting() {
      setSubmitting(false);
      updateSelectedQuantity();
    }

    updateSelectedQuantity();
    inputs.forEach((input) => {
      input.addEventListener("input", updateSelectedQuantity);
      input.addEventListener("change", updateSelectedQuantity);
    });
    form?.addEventListener("submit", handleSubmit);
    window.addEventListener("pageshow", resetSubmitting);

    return () => {
      inputs.forEach((input) => {
        input.removeEventListener("input", updateSelectedQuantity);
        input.removeEventListener("change", updateSelectedQuantity);
      });
      form?.removeEventListener("submit", handleSubmit);
      window.removeEventListener("pageshow", resetSubmitting);
    };
  }, []);

  const disabled = selectedQuantity <= 0 || submitting;

  return (
    <button
      aria-busy={submitting}
      className="button fullButton addToCartButton"
      disabled={disabled}
      ref={buttonRef}
      type="submit"
    >
      {submitting ? (
        <>
          <span className="buttonSpinner" aria-hidden="true" />
          Abrindo checkout...
        </>
      ) : (
        "Adicionar ao carrinho"
      )}
    </button>
  );
}
