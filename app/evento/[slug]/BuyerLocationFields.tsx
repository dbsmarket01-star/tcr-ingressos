"use client";

import { useEffect, useMemo, useState } from "react";

type BuyerLocationFieldsProps = {
  defaultPostalCode?: string;
  defaultCity?: string;
  defaultState?: string;
};

type ViaCepResponse = {
  erro?: boolean;
  localidade?: string;
  uf?: string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatPostalCode(value: string) {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function BuyerLocationFields({
  defaultPostalCode = "",
  defaultCity = "",
  defaultState = ""
}: BuyerLocationFieldsProps) {
  const [postalCode, setPostalCode] = useState(formatPostalCode(defaultPostalCode));
  const [city, setCity] = useState(defaultCity);
  const [state, setState] = useState(defaultState);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const postalDigits = useMemo(() => onlyDigits(postalCode), [postalCode]);

  useEffect(() => {
    let isActive = true;

    if (postalDigits.length !== 8) {
      setLookupStatus("idle");
      return;
    }

    setLookupStatus("loading");

    fetch(`https://viacep.com.br/ws/${postalDigits}/json/`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ViaCepResponse | null) => {
        if (!isActive) {
          return;
        }

        if (!data || data.erro || !data.localidade) {
          setLookupStatus("not-found");
          return;
        }

        setCity(data.localidade);
        setState(data.uf || "");
        setLookupStatus("found");
      })
      .catch(() => {
        if (isActive) {
          setLookupStatus("not-found");
        }
      });

    return () => {
      isActive = false;
    };
  }, [postalDigits]);

  return (
    <div className="buyerLocationGrid">
      <label className="field">
        <span>CEP</span>
        <input
          autoComplete="postal-code"
          inputMode="numeric"
          name="buyerPostalCode"
          onChange={(event) => setPostalCode(formatPostalCode(event.target.value))}
          placeholder="01001-000"
          required
          value={postalCode}
        />
        <small>
          {lookupStatus === "loading"
            ? "Buscando cidade..."
            : lookupStatus === "found"
              ? "Cidade preenchida automaticamente."
              : "Usado apenas para identificar a cidade da compra."}
        </small>
      </label>

      <label className="field">
        <span>Cidade</span>
        <input
          autoComplete="address-level2"
          name="buyerCity"
          onChange={(event) => setCity(event.target.value)}
          placeholder="Ex: São Paulo"
          required
          value={city}
        />
        <input name="buyerState" type="hidden" value={state} />
        <small>{state ? `UF: ${state}` : "Se o CEP não preencher, informe a cidade manualmente."}</small>
      </label>
    </div>
  );
}
