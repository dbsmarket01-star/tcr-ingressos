export const DEFAULT_CREDIT_CARD_INSTALLMENT_LIMIT = 10;
export const A2_IMERGIDOS_CONECTADOS_INSTALLMENT_LIMIT = 6;

type InstallmentEvent = {
  slug: string;
  title?: string | null;
};

export function getCreditCardInstallmentLimitForEvent(event: InstallmentEvent) {
  if (event.slug === "a2-imergidos-conectados") {
    return A2_IMERGIDOS_CONECTADOS_INSTALLMENT_LIMIT;
  }

  return DEFAULT_CREDIT_CARD_INSTALLMENT_LIMIT;
}
