export const SOROCABA_EVENT_SLUG = "rodrigo-teaser-em-sorocaba-2026";
export const SOROCABA_MAX_TICKETS_PER_ORDER = 20;

/** Only unnumbered chair/first-row tickets use the 20-ticket counter. */
export function effectiveLotMaxPerOrder(eventSlug: string, lot: {
  name: string;
  hasTypeOptions: boolean;
  maxPerOrder: number;
}) {
  if (eventSlug !== SOROCABA_EVENT_SLUG || lot.hasTypeOptions ||
      !/^(?:CADEIRA\s+(?:PRATA|OURO)|PRIMEIRA\s+FILEIRA)\b/i.test(lot.name)) {
    return lot.maxPerOrder;
  }
  return SOROCABA_MAX_TICKETS_PER_ORDER;
}

export function validateSorocabaOrderQuantity(eventSlug: string, quantities: number[]) {
  if (eventSlug !== SOROCABA_EVENT_SLUG) return;
  if (quantities.reduce((sum, quantity) => sum + quantity, 0) > SOROCABA_MAX_TICKETS_PER_ORDER) {
    throw new Error(`Limite de ${SOROCABA_MAX_TICKETS_PER_ORDER} ingressos por pedido para este evento.`);
  }
}
