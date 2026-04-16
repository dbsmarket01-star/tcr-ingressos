"use client";

import { useEffect, useMemo, useState } from "react";

type CheckoutEstimatorLot = {
  id: string;
  name: string;
  totalWithFeeInCents: number;
};

type CheckoutEstimatorProps = {
  lots: CheckoutEstimatorLot[];
};

function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueInCents / 100);
}

export function CheckoutEstimator({ lots }: CheckoutEstimatorProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const lotMap = useMemo(() => new Map(lots.map((lot) => [lot.id, lot])), [lots]);

  useEffect(() => {
    const inputs = lots
      .map((lot) => document.querySelector<HTMLInputElement>(`input[name="quantity_${lot.id}"]`))
      .filter((input): input is HTMLInputElement => Boolean(input));

    function readQuantities() {
      setQuantities(
        Object.fromEntries(
          inputs.map((input) => [
            input.name.replace("quantity_", ""),
            Math.max(Number(input.value || 0), 0)
          ])
        )
      );
    }

    readQuantities();
    inputs.forEach((input) => input.addEventListener("input", readQuantities));

    return () => {
      inputs.forEach((input) => input.removeEventListener("input", readQuantities));
    };
  }, [lots]);

  const selectedQuantity = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
  const estimatedTotalInCents = Object.entries(quantities).reduce((sum, [lotId, quantity]) => {
    const lot = lotMap.get(lotId);
    return sum + (lot?.totalWithFeeInCents ?? 0) * quantity;
  }, 0);
  const selectedLots = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([lotId, quantity]) => {
      const lot = lotMap.get(lotId);
      return lot ? `${quantity}x ${lot.name}` : null;
    })
    .filter(Boolean);

  return (
    <div className="checkoutEstimator" aria-live="polite">
      <div>
        <span>Selecionado</span>
        <strong>{selectedQuantity} ingresso(s)</strong>
      </div>
      <div>
        <span>Total estimado</span>
        <strong>{formatCurrency(estimatedTotalInCents)}</strong>
      </div>
      <p>{selectedLots.length > 0 ? selectedLots.join(" + ") : "Escolha a quantidade de ingressos para continuar."}</p>
    </div>
  );
}
