const A2_IMERGIDOS_ORGANIZATION_SLUG = "a2-imergidos";
const TCR_INGRESSOS_ORGANIZATION_SLUG = "tcr-ingressos";
const A2_SERVICE_FEE_EVENT_SLUGS = new Set(["a2-imergidos-ibf-church-sao-paulo"]);

export function isFeeFreeOrganization(organizationSlug?: string | null, eventSlug?: string | null) {
  return organizationSlug === A2_IMERGIDOS_ORGANIZATION_SLUG && !A2_SERVICE_FEE_EVENT_SLUGS.has(eventSlug ?? "");
}

export function getEffectiveServiceFeeBps(
  organizationSlug: string | null | undefined,
  serviceFeeBps: number,
  eventSlug?: string | null
) {
  return isFeeFreeOrganization(organizationSlug, eventSlug) ? 0 : serviceFeeBps;
}

export function getEffectiveFixedOrderFeeInCents(
  organizationSlug: string | null | undefined,
  fixedOrderFeeInCents: number,
  _eventSlug?: string | null
) {
  return organizationSlug === A2_IMERGIDOS_ORGANIZATION_SLUG ? 0 : fixedOrderFeeInCents;
}

export function finalizeOrganizationPublicPriceInCents(
  _organizationSlug: string | null | undefined,
  valueInCents: number
) {
  return Math.max(Math.round(valueInCents), 0);
}

export function getEffectivePaymentFeeSettings<T extends {
  pixTransactionFeeInCents: number;
  cardBaseFeeBps: number;
  cardAdditionalInstallmentFeeBps: number;
}>(organizationSlug: string | null | undefined, settings: T, _eventSlug?: string | null): T {
  if (organizationSlug === TCR_INGRESSOS_ORGANIZATION_SLUG) {
    return {
      ...settings,
      cardFirstInstallmentInterestFree: true
    };
  }
  if (organizationSlug !== A2_IMERGIDOS_ORGANIZATION_SLUG) {
    return settings;
  }

  return {
    ...settings,
    pixTransactionFeeInCents: 0,
    cardBaseFeeBps: 0,
    cardAdditionalInstallmentFeeBps: 0
  };
}
