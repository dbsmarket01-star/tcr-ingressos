import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedPublicEventBySlugInOrganization } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { effectiveLotMaxPerOrder, SOROCABA_EVENT_SLUG } from "@/features/orders/sorocaba-quantity-limit";
import { QuantityPicker } from "./QuantityPicker";
import styles from "./quantity.module.css";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lotId?: string; adId?: string }>;
};

export default async function EventQuantityPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { lotId, adId } = await searchParams;
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

  const checkoutParams = new URLSearchParams({
    lotId: lot.id,
    utm_source: "whatsapp",
    utm_medium: "meta_ads",
    utm_campaign: "rodrigo_sorocaba_whatsapp"
  });
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
            priceInCents={lot.priceInCents}
            min={min}
            max={max}
            checkoutPath={`/evento/${slug}/checkout?${checkoutParams.toString()}`}
          />
        </div>
      </div>
    </main>
  );
}
