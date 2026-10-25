"use client";

import { useState } from "react";
import { FeeExplanationButton } from "../FeeExplanationButton";
import styles from "./quantity.module.css";

type Props = {
  lotName: string;
  min: number;
  max: number;
  pricesByQuantity: Array<{ quantity: number; ticketsInCents: number; feeInCents: number; totalInCents: number }>;
  checkoutPath: string;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function QuantityPicker({ lotName, min, max, pricesByQuantity, checkoutPath }: Props) {
  const [quantity, setQuantity] = useState(min);
  const price = pricesByQuantity[quantity - min];
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
        <strong>{money.format(price.ticketsInCents / 100)}</strong>
      </div>
      <div className={styles.feeRow}>
        <span className={styles.feeLabel}>Taxa de bilheteria <FeeExplanationButton variant="icon" /></span>
        <strong>{money.format(price.feeInCents / 100)}</strong>
      </div>
      <div className={styles.grandTotal}>
        <span>Total do pedido</span>
        <strong>{money.format(price.totalInCents / 100)}</strong>
      </div>
      <a className={styles.continue} href={checkoutUrl}>Continuar para pagamento <span aria-hidden="true">→</span></a>
      <p className={styles.note}>Na próxima etapa, informe seus dados para seguir ao pagamento. Você poderá revisar o pedido antes de pagar.</p>
    </section>
  );
}
