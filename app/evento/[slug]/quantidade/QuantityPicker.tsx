"use client";

import { useState } from "react";
import styles from "./quantity.module.css";

type Props = {
  lotName: string;
  priceInCents: number;
  min: number;
  max: number;
  checkoutPath: string;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function QuantityPicker({ lotName, priceInCents, min, max, checkoutPath }: Props) {
  const [quantity, setQuantity] = useState(min);
  const params = new URLSearchParams(checkoutPath.split("?")[1]);
  const lotId = params.get("lotId");
  if (lotId) params.set(`quantity_${lotId}`, String(quantity));
  const checkoutUrl = `${checkoutPath.split("?")[0]}?${params.toString()}#cadastro`;

  return (
    <section className={styles.picker} aria-label={`Quantidade para ${lotName}`}>
      <span className={styles.caption}>Quantidade de ingressos</span>
      <div className={styles.controls}>
        <button type="button" className={styles.control} aria-label="Diminuir quantidade"
          disabled={quantity <= min} onClick={() => setQuantity((current) => Math.max(min, current - 1))}>−</button>
        <output className={styles.count} aria-live="polite" aria-label={`${quantity} ${quantity === 1 ? "ingresso" : "ingressos"}`}>{quantity}</output>
        <button type="button" className={styles.control} aria-label="Aumentar quantidade"
          disabled={quantity >= max} onClick={() => setQuantity((current) => Math.min(max, current + 1))}>+</button>
      </div>
      <small>Até {max} {max === 1 ? "ingresso" : "ingressos"} neste pedido, conforme a disponibilidade.</small>
      <div className={styles.total}>
        <span>Valor dos ingressos</span>
        <strong>{money.format(priceInCents * quantity / 100)}</strong>
      </div>
      <p className={styles.fees}>+ taxas. O total completo aparece na próxima etapa, antes do pagamento.</p>
      <a className={styles.continue} href={checkoutUrl}>Continuar para meus dados <span aria-hidden="true">→</span></a>
      <p className={styles.note}>Você ainda poderá revisar o pedido antes de pagar.</p>
    </section>
  );
}
