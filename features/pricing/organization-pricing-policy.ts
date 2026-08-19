import { roundPublicPriceUpInCents } from "./pricing";

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
  organizationSlug: string | null | undefined,
  valueInCents: number
) {
  const safeValueInCents = Math.max(Math.round(valueInCents), 0);
  return isFeeFreeOrganization(organizationSlug)
    ? safeValueInCents
    : roundPublicPriceUpInCents(safeValueInCents);
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
