const A2_IMERGIDOS_ORGANIZATION_SLUG = "a2-imergidos";

export function isFeeFreeOrganization(organizationSlug?: string | null) {
  return organizationSlug === A2_IMERGIDOS_ORGANIZATION_SLUG;
}

export function getEffectiveServiceFeeBps(organizationSlug: string | null | undefined, serviceFeeBps: number) {
  return isFeeFreeOrganization(organizationSlug) ? 0 : serviceFeeBps;
}

export function getEffectiveFixedOrderFeeInCents(
  organizationSlug: string | null | undefined,
  fixedOrderFeeInCents: number
) {
  return isFeeFreeOrganization(organizationSlug) ? 0 : fixedOrderFeeInCents;
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
}>(organizationSlug: string | null | undefined, settings: T): T {
  if (!isFeeFreeOrganization(organizationSlug)) {
    return settings;
  }

  return {
    ...settings,
    pixTransactionFeeInCents: 0,
    cardBaseFeeBps: 0,
    cardAdditionalInstallmentFeeBps: 0
  };
}
