"use client";

import { useEffect, useState } from "react";

function readSelectedQuantity() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="quantity_"]')).reduce(
    (sum, input) => sum + Math.max(Number(input.value || 0), 0),
    0
  );
}

export function AddToCartButton() {
  const [selectedQuantity, setSelectedQuantity] = useState(0);

  useEffect(() => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="quantity_"]'));

    function updateSelectedQuantity() {
      setSelectedQuantity(readSelectedQuantity());
    }

    updateSelectedQuantity();
    inputs.forEach((input) => input.addEventListener("input", updateSelectedQuantity));

    return () => {
      inputs.forEach((input) => input.removeEventListener("input", updateSelectedQuantity));
    };
  }, []);

  return (
    <button className="button fullButton addToCartButton" disabled={selectedQuantity <= 0} type="submit">
      Adicionar ao carrinho
    </button>
  );
}
