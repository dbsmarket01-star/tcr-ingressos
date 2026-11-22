"use client";

import { useEffect, useRef, useState } from "react";
import { buildAddToCartPayload } from "@/features/tracking/add-to-cart";

function readSelectedQuantity() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="quantity_"]')).reduce(
    (sum, input) => sum + Math.max(Number(input.value || 0), 0),
    0
  );
}

export function AddToCartButton({ eventTitle, hasMetaPixel }: { eventTitle: string; hasMetaPixel: boolean }) {
  const [selectedQuantity, setSelectedQuantity] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const trackingSentRef = useRef(false);

  useEffect(() => {
    const form = buttonRef.current?.form;

    function updateSelectedQuantity() {
      setSelectedQuantity(readSelectedQuantity());
    }

    function handleSubmit() {
      if (readSelectedQuantity() > 0) {
        setSubmitting(true);
        if (hasMetaPixel && !trackingSentRef.current && typeof window.fbq === "function" && form) {
          const payload = buildAddToCartPayload(new FormData(form), eventTitle);
          if (payload) {
            window.fbq("track", "AddToCart", payload);
            trackingSentRef.current = true;
          }
        }
      }
    }

    function resetSubmitting() {
      setSubmitting(false);
      trackingSentRef.current = false;
      updateSelectedQuantity();
    }

    updateSelectedQuantity();
    form?.addEventListener("input", updateSelectedQuantity);
    form?.addEventListener("change", updateSelectedQuantity);
    form?.addEventListener("submit", handleSubmit);
    window.addEventListener("seatmap-selection-change", updateSelectedQuantity);
    window.addEventListener("pageshow", resetSubmitting);
    const observer = form ? new MutationObserver(updateSelectedQuantity) : null;
    observer?.observe(form as HTMLFormElement, { childList: true, subtree: true });

    return () => {
      form?.removeEventListener("input", updateSelectedQuantity);
      form?.removeEventListener("change", updateSelectedQuantity);
      form?.removeEventListener("submit", handleSubmit);
      window.removeEventListener("seatmap-selection-change", updateSelectedQuantity);
      window.removeEventListener("pageshow", resetSubmitting);
      observer?.disconnect();
    };
  }, [eventTitle, hasMetaPixel]);

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
