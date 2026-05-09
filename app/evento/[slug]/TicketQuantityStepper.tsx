"use client";

import { useEffect, useRef, useState } from "react";

type TicketQuantityStepperProps = {
  max: number;
  name: string;
  label: string;
};

export function TicketQuantityStepper({ max, name, label }: TicketQuantityStepperProps) {
  const [quantity, setQuantity] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const safeMax = Math.max(0, max);

  useEffect(() => {
    inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [quantity]);

  function updateQuantity(nextQuantity: number) {
    setQuantity(Math.min(Math.max(nextQuantity, 0), safeMax));
  }

  return (
    <div className="ticketQuantityStepper" aria-label={label}>
      <input ref={inputRef} type="hidden" name={name} value={quantity} readOnly />
      <button
        aria-label={`Remover ${label}`}
        className="ticketQuantityButton ticketQuantityButtonMinus"
        disabled={quantity <= 0}
        onClick={() => updateQuantity(quantity - 1)}
        type="button"
      >
        -
      </button>
      <output aria-live="polite">{quantity}</output>
      <button
        aria-label={`Adicionar ${label}`}
        className="ticketQuantityButton ticketQuantityButtonPlus"
        disabled={quantity >= safeMax}
        onClick={() => updateQuantity(quantity + 1)}
        type="button"
      >
        +
      </button>
    </div>
  );
}
