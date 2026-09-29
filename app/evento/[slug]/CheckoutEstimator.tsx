"use client";

import { useEffect, useMemo, useState } from "react";

type CheckoutEstimatorLot = {
  admissionsPerUnit: number;
  id: string;
  name: string;
  totalWithFeeInCents: number;
};

type CheckoutEstimatorProps = {
  fixedOrderFeeInCents: number;
  lots: CheckoutEstimatorLot[];
  feeFree?: boolean;
};

function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueInCents / 100);
}

export function CheckoutEstimator({ fixedOrderFeeInCents, lots, feeFree = false }: CheckoutEstimatorProps) {
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
    inputs.forEach((input) => {
      input.addEventListener("input", readQuantities);
      input.addEventListener("change", readQuantities);
    });

    return () => {
      inputs.forEach((input) => {
        input.removeEventListener("input", readQuantities);
        input.removeEventListener("change", readQuantities);
      });
    };
  }, [lots]);

  const selectedQuantity = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
  const selectedAdmissions = Object.entries(quantities).reduce((sum, [lotId, quantity]) => {
    const lot = lotMap.get(lotId);
    return sum + quantity * Math.max(lot?.admissionsPerUnit ?? 1, 1);
  }, 0);
  const selectedTicketsTotalInCents = Object.entries(quantities).reduce((sum, [lotId, quantity]) => {
    const lot = lotMap.get(lotId);
    return sum + (lot?.totalWithFeeInCents ?? 0) * quantity;
  }, 0);
  const unroundedEstimatedTotalInCents = selectedTicketsTotalInCents + Math.max(fixedOrderFeeInCents, 0);
  const estimatedTotalInCents = selectedQuantity > 0 ? unroundedEstimatedTotalInCents : 0;
  const selectedLots = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([lotId, quantity]) => {
      const lot = lotMap.get(lotId);
      return lot ? `${quantity}x ${lot.name}` : null;
    })
    .filter(Boolean);
  const selectedEntries = Object.entries(quantities).filter(([, quantity]) => quantity > 0);
  const selectedTableLot =
    selectedEntries.length === 1
      ? lotMap.get(selectedEntries[0][0])
      : null;
  const selectedTableQuantity = selectedEntries.length === 1 ? selectedEntries[0][1] : 0;
  const isTableSelection =
    Boolean(selectedTableLot) &&
    (selectedTableLot?.admissionsPerUnit ?? 1) > 1 &&
    /\bmesa\b/i.test(selectedTableLot?.name ?? "");
  const selectedLabel = isTableSelection
    ? `${selectedTableQuantity} ${selectedTableQuantity === 1 ? "mesa selecionada" : "mesas selecionadas"} — ${selectedAdmissions} ${selectedAdmissions === 1 ? "ingresso" : "ingressos"}`
    : `${selectedAdmissions} ${selectedAdmissions === 1 ? "ingresso" : "ingressos"}`;

  if (selectedQuantity === 0) {
    return null;
  }

  return (
    <div className="checkoutEstimator" aria-live="polite">
      <div>
        <span>Selecionado</span>
        <strong>{selectedLabel}</strong>
      </div>
      <div>
        <span>{feeFree ? "Preço final • taxa zero" : "Total estimado"}</span>
        <strong>{formatCurrency(estimatedTotalInCents)}</strong>
      </div>
      <p>{selectedLots.length > 0 ? selectedLots.join(" + ") : "Escolha a quantidade de ingressos para continuar."}</p>
    </div>
  );
}
