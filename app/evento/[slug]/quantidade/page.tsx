import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedPublicEventBySlugInOrganization } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { effectiveLotMaxPerOrder, SOROCABA_EVENT_SLUG } from "@/features/orders/sorocaba-quantity-limit";
import { calculateAsaasSplitsForOrder, sumAsaasSplitsInCents } from "@/features/payments/asaas-split.service";
import { calculateServiceFeeInCents } from "@/features/pricing/pricing";
import { finalizeOrganizationPublicPriceInCents, getEffectiveFixedOrderFeeInCents, getEffectiveServiceFeeBps, isFeeFreeOrganization } from "@/features/pricing/organization-pricing-policy";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { listPaymentSplitRules } from "@/features/settings/split-settings.service";
import { QuantityPicker } from "./QuantityPicker";
import styles from "./quantity.module.css";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lotId?: string; adId?: string; paidAd?: string }>;
};

export default async function EventQuantityPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { lotId, adId, paidAd } = await searchParams;
  if (slug !== SOROCABA_EVENT_SLUG || !lotId) notFound();

  const organization = await getCurrentOrganizationContext();
  const event = await getCachedPublicEventBySlugInOrganization(slug, organization.organization.id);
  const lot = event?.lots.find((item) => item.id === lotId);
  const now = new Date();
  if (!event || !lot || lot.hasTypeOptions || lot.status !== "ACTIVE" || lot.saleBadge === "SOLD_OUT" ||
      (lot.salesStartsAt && lot.salesStartsAt > now) || (lot.salesEndsAt && lot.salesEndsAt <= now) ||
      (event.salesStartsAt && event.salesStartsAt > now) || (event.salesEndsAt && event.salesEndsAt <= now)) notFound();

  const available = Math.max(0, lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity);
  const max = Math.min(effectiveLotMaxPerOrder(slug, lot), available);
  const min = Math.max(1, lot.minPerOrder);
  if (max < min) notFound();

  const [companySettings, splitRules] = await Promise.all([
    getCompanySettingsByOrganizationId(organization.organization.id),
    listPaymentSplitRules(organization.organization.id)
  ]);
  const organizationSlug = organization.organization.slug;
  const effectiveSplitRules = isFeeFreeOrganization(organizationSlug, event.slug) ? [] : splitRules.filter((rule) => rule.isActive);
  const effectiveFixedOrderFeeInCents = getEffectiveFixedOrderFeeInCents(organizationSlug, companySettings.pixTransactionFeeInCents, event.slug);
  const serviceFeeBps = getEffectiveServiceFeeBps(organizationSlug, lot.serviceFeeBps, event.slug);
  const pricesByQuantity = Array.from({ length: max - min + 1 }, (_, index) => {
    const quantity = min + index;
    const ticketsInCents = lot.priceInCents * quantity;
    const configuredFeeInCents = calculateServiceFeeInCents(lot.priceInCents, quantity, serviceFeeBps);
    const splitsInCents = sumAsaasSplitsInCents(calculateAsaasSplitsForOrder([
      { quantity, totalInCents: ticketsInCents, admissionsPerUnit: lot.admissionsPerUnit }
    ], effectiveSplitRules));
    const totalInCents = finalizeOrganizationPublicPriceInCents(
      organizationSlug,
      ticketsInCents + Math.max(configuredFeeInCents, splitsInCents) + effectiveFixedOrderFeeInCents
    );
    return { quantity, ticketsInCents, feeInCents: totalInCents - ticketsInCents, totalInCents };
  });

  const checkoutParams = new URLSearchParams({
    lotId: lot.id,
    utm_source: "whatsapp",
    utm_medium: paidAd === "1" ? "meta_ads" : "organic",
    utm_campaign: "rodrigo_sorocaba_whatsapp"
  });
  if (paidAd === "1") checkoutParams.set("utm_term", "verified_meta_referral");
  if (adId && /^\d{1,30}$/.test(adId)) checkoutParams.set("utm_content", adId);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.back} href={`/evento/${slug}#ingressos`}>← Ver todos os ingressos</Link>
        <div className={styles.card}>
          <span className={styles.eyebrow}>TCR Ingressos · compra segura</span>
          <h1>Escolha sua quantidade</h1>
          <p className={styles.event}>{event.title}</p>
          <div className={styles.ticket}>
            <span>Ingresso selecionado</span>
            <strong>{lot.name}</strong>
            {lot.description ? <p>{lot.description}</p> : null}
          </div>
          <QuantityPicker
            lotName={lot.name}
            min={min}
            max={max}
            pricesByQuantity={pricesByQuantity}
            checkoutPath={`/evento/${slug}/checkout?${checkoutParams.toString()}`}
          />
        </div>
      </div>
    </main>
  );
}
