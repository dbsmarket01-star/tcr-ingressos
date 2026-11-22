"use client";

import { useEffect, useRef, useState } from "react";
import { buildAddToCartPayload } from "@/features/tracking/add-to-cart";

function readSelectedQuantity() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="quantity_"]')).reduce(
    (sum, input) => sum + Math.max(Number(input.value || 0), 0),
    0
  );
}

function readMetaCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!match) return "";
  try { return decodeURIComponent(match[1]); } catch { return ""; }
}

function sendCartEventToServer(eventId: string, trackingEventId: string, contents: Array<{ id: string; quantity: number }>) {
  const fbclid = new URLSearchParams(window.location.search).get("fbclid")?.trim();
  const body = JSON.stringify({
    eventId,
    trackingEventId,
    contents,
    sourceUrl: window.location.href,
    fbp: readMetaCookie("_fbp"),
    fbc: readMetaCookie("_fbc") || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : "")
  });
  const url = "/api/public/meta/add-to-cart";

  if (navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;
  void fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}

export function AddToCartButton({ eventId, eventTitle, hasMetaPixel, lotPricesInCents }: {
  eventId: string; eventTitle: string; hasMetaPixel: boolean; lotPricesInCents: Record<string, number>
}) {
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
        if (hasMetaPixel && !trackingSentRef.current && form) {
          try {
            const payload = buildAddToCartPayload(new FormData(form), eventTitle, lotPricesInCents);
            if (payload) {
              trackingSentRef.current = true;
              const trackingEventId = `cart:${crypto.randomUUID()}`;
              window.fbq?.("track", "AddToCart", payload, { eventID: trackingEventId });
              sendCartEventToServer(eventId, trackingEventId, payload.contents);
            }
          } catch (error) {
            // Marketing tracking must never block the ticket checkout.
            console.warn("[tracking] AddToCart indisponível", error);
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
  }, [eventId, eventTitle, hasMetaPixel, lotPricesInCents]);

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
