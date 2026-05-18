"use client";

import { useEffect, useRef, useState } from "react";

type TicketTypeSelectorProps = {
  label: string;
  lotId: string;
  options: Array<{
    id: string;
    label: string;
  }>;
};

export function TicketTypeSelector({ label, lotId, options }: TicketTypeSelectorProps) {
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [selectedOptionId]);

  return (
    <div className="ticketTypeSelector" aria-label={`Tipos disponíveis para ${label}`}>
      {selectedOptionId ? <input type="hidden" name="lotId" value={lotId} /> : null}
      <input
        ref={inputRef}
        type="hidden"
        name={`quantity_${lotId}`}
        value={selectedOptionId ? "1" : "0"}
        readOnly
      />
      <label>
        <span>Tipo</span>
        <select
          name={`lotOption_${lotId}`}
          value={selectedOptionId}
          onChange={(event) => setSelectedOptionId(event.target.value)}
        >
          <option value="">Selecione...</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
