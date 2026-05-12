import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { WhatsappFloatingButton } from "@/components/public/WhatsappFloatingButton";
import { getBuyerProfile } from "@/features/customer-auth/google-buyer.service";
import { getCachedEventSeoBySlugInOrganization, getCachedPublicEventBySlugInOrganization } from "@/features/events/event.service";
import { createCheckoutOrderAction } from "@/features/orders/order.actions";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { calculateServiceFeeInCents } from "@/features/pricing/pricing";
import { buildEventSeo } from "@/features/seo/event-seo";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { getTrackingParamsFromSearch } from "@/features/tracking/tracking";
import { getPublicEventBranding } from "@/lib/event-branding";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { MetaTrackingFields } from "../MetaTrackingFields";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type CheckoutPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function allParams(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function buildCheckoutPath(slug: string, query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    allParams(value).forEach((entry) => {
      if (entry) {
        params.append(key, entry);
      }
    });
  }

  const queryString = params.toString();
  return `/evento/${slug}/checkout${queryString ? `?${queryString}` : ""}#cadastro`;
}

function parseQuantity(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value) ?? 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.floor(parsed);
}

export async function generateMetadata({ params }: Pick<CheckoutPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const organizationContext = await getCurrentOrganizationContext();
  const event = await getCachedEventSeoBySlugInOrganization(slug, organizationContext.organization.id);

  if (!event) {
    return {
      title: `Checkout | ${organizationContext.brandName}`
    };
  }

  const seo = buildEventSeo(event);

  return {
    title: `Cadastro | ${seo.title}`,
    description: seo.description
  };
}

export default async function EventCheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const organizationContext = await getCurrentOrganizationContext();
  const [event, buyerProfile, companySettings] = await Promise.all([
    getCachedPublicEventBySlugInOrganization(slug, organizationContext.organization.id),
    getBuyerProfile(),
    getCompanySettingsByOrganizationId(organizationContext.organization.id)
  ]);

  if (!event) {
    notFound();
  }

  const now = new Date();
  const activeLots = event.lots.filter((lot) => {
    const startsOk = !lot.salesStartsAt || lot.salesStartsAt <= now;
    const endsOk = !lot.salesEndsAt || lot.salesEndsAt >= now;
    const hasStock = lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity > 0;
    return startsOk && endsOk && hasStock;
  });
  const requestedLotIds = new Set(allParams(query.lotId).map((lotId) => lotId.trim()).filter(Boolean));
  const selectedItems = activeLots.flatMap((lot) => {
    if (!requestedLotIds.has(lot.id)) {
      return [];
    }

    const available = lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity;
    const maxQuantity = Math.max(0, Math.min(lot.maxPerOrder, available));
    const requestedQuantity = parseQuantity(query[`quantity_${lot.id}`]);
    const quantity = Math.min(Math.max(requestedQuantity, 0), maxQuantity);

    if (quantity <= 0) {
      return [];
    }

    const serviceFeeInCents = calculateServiceFeeInCents(lot.priceInCents, quantity, lot.serviceFeeBps);
    const subtotalInCents = lot.priceInCents * quantity;

    return [{
      lot,
      quantity,
      serviceFeeInCents,
      subtotalInCents,
      totalInCents: subtotalInCents + serviceFeeInCents
    }];
  });

  if (selectedItems.length === 0) {
    redirect(`/evento/${event.slug}?checkoutError=${encodeURIComponent("Selecione pelo menos 1 ingresso.")}#ingressos`);
  }

  const checkoutError = typeof query.checkoutError === "string" ? query.checkoutError : null;
  const tracking = getTrackingParamsFromSearch(query, `/evento/${event.slug}`);
  const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const hotelItems = selectedItems.filter((item) => item.lot.hasHotel);
  const ticketsTotalInCents = selectedItems.reduce((sum, item) => sum + item.subtotalInCents, 0);
  const serviceFeeTotalInCents = selectedItems.reduce((sum, item) => sum + item.serviceFeeInCents, 0);
  const orderTotalInCents = selectedItems.reduce((sum, item) => sum + item.totalInCents, 0);
  const currentCheckoutPath = buildCheckoutPath(event.slug, query);
  const landingPage = firstParam(query.landingPage) || tracking.landingPage;
  const publicSocialSettings = companySettings as typeof companySettings & {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    youtubeUrl?: string | null;
    whatsappUrl?: string | null;
  };
  const eventBranding = getPublicEventBranding(organizationContext, event);

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href={eventBranding.homeHref}>
          {eventBranding.brandLogoUrl ? (
            <img alt={eventBranding.brandName} className="brandLogo" src={eventBranding.brandLogoUrl} />
          ) : (
            <span className="brandMark">{eventBranding.brandMark}</span>
          )}
          {!eventBranding.brandLogoUrl ? <span>{eventBranding.brandName}</span> : null}
        </Link>
        <nav className="nav" aria-label="Navegação">
          <Link href={`/evento/${event.slug}#ingressos`}>Ingressos</Link>
        </nav>
      </header>

      <section className="container checkoutFlowPage">
        <Link className="checkoutBackLink" href={`/evento/${event.slug}#ingressos`}>
          Voltar para ingressos
        </Link>
        <div className="checkoutFlowGrid">
          <aside className="checkoutCartPanel" aria-label="Resumo do carrinho">
            <span className="eyebrow">Seu carrinho</span>
            <h1>{event.title}</h1>
            <p>{formatDateTime(event.startsAt)}</p>
            <p>
              {event.venueName} - {event.city}, {event.state}
            </p>
            <div className="checkoutCartItems">
              {selectedItems.map((item) => (
                <div className="checkoutCartItem" key={item.lot.id}>
                  <div>
                    <strong>
                      {item.quantity}x {item.lot.name}
                    </strong>
                    <span>
                      {formatCurrency(item.lot.priceInCents)}
                      {item.serviceFeeInCents > 0 ? ` + ${formatCurrency(item.serviceFeeInCents)} taxa` : ""}
                    </span>
                  </div>
                  <strong>{formatCurrency(item.totalInCents)}</strong>
                </div>
              ))}
            </div>
            <div className="checkoutCartTotal">
              <div>
                <span>Ingressos</span>
                <strong>{formatCurrency(ticketsTotalInCents)}</strong>
              </div>
              <div>
                <span>Taxas</span>
                <strong>{formatCurrency(serviceFeeTotalInCents)}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatCurrency(orderTotalInCents)}</strong>
              </div>
            </div>
            {event.couponsEnabled ? (
              <div className="checkoutCartCoupon">
                <div>
                  <span className="checkoutCartCouponLabel">Cupom de desconto</span>
                  <p>Digite o código e o desconto será validado ao continuar.</p>
                </div>
                <label className="checkoutCartCouponField">
                  <span>Código do cupom</span>
                  <input
                    form="checkoutRegistrationForm"
                    name="coupon"
                    placeholder="Ex: PROMO10"
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                </label>
              </div>
            ) : null}
            <Link className="secondaryButton fullButton" href={`/evento/${event.slug}#ingressos`}>
              Alterar ingressos
            </Link>
          </aside>

          <section className="checkoutRegistrationPanel" id="cadastro">
            <span className="checkoutStepEyebrow">Etapa 2 de 2</span>
            <h2>Dados do comprador</h2>
            <p>
              Informe os dados de quem receberá {totalQuantity > 1 ? "os ingressos" : "o ingresso"}. Você poderá
              revisar o pedido antes do pagamento.
            </p>

            <form id="checkoutRegistrationForm" action={createCheckoutOrderAction} className="form checkoutRegistrationForm">
              {checkoutError ? <div className="errorBox">{checkoutError}</div> : null}
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="eventSlug" value={event.slug} />
              <input type="hidden" name="utmSource" value={tracking.utmSource ?? ""} />
              <input type="hidden" name="utmMedium" value={tracking.utmMedium ?? ""} />
              <input type="hidden" name="utmCampaign" value={tracking.utmCampaign ?? ""} />
              <input type="hidden" name="utmContent" value={tracking.utmContent ?? ""} />
              <input type="hidden" name="utmTerm" value={tracking.utmTerm ?? ""} />
              <input type="hidden" name="referrer" value={tracking.referrer ?? ""} />
              <input type="hidden" name="landingPage" value={landingPage ?? ""} />
              {selectedItems.map((item) => (
                <div key={item.lot.id}>
                  <input type="hidden" name="lotId" value={item.lot.id} />
                  <input type="hidden" name={`quantity_${item.lot.id}`} value={item.quantity} />
                </div>
              ))}
              <MetaTrackingFields />

              <div className="checkoutBuyer checkoutBuyerNoTopBorder">
                <a
                  className="googleButton"
                  href={`/api/auth/google/start?returnTo=${encodeURIComponent(currentCheckoutPath)}`}
                >
                  <span>G</span>
                  Continuar com Google
                </a>
                {buyerProfile ? (
                  <p className="success">
                    Nome e e-mail preenchidos com sua conta Google: {buyerProfile.email}
                  </p>
                ) : null}
                <label className="field">
                  <span>Nome completo</span>
                  <input
                    name="buyerName"
                    autoComplete="name"
                    required
                    defaultValue={buyerProfile?.name || ""}
                  />
                </label>
                <label className="field">
                  <span>Email para receber os ingressos</span>
                  <input
                    name="buyerEmail"
                    type="email"
                    autoComplete="email"
                    required
                    defaultValue={buyerProfile?.email || ""}
                  />
                  <small>O pedido, o comprovante e os QR Codes serão enviados para este e-mail.</small>
                </label>
                <label className="field">
                  <span>CPF</span>
                  <input
                    name="buyerDocument"
                    autoComplete="off"
                    inputMode="numeric"
                    required
                  />
                </label>
                <label className="field">
                  <span>Telefone</span>
                  <input
                    name="buyerPhone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    defaultValue={buyerProfile?.phone || ""}
                  />
                  <small>Usado apenas para suporte do pedido, caso seja necessário.</small>
                </label>
              </div>

              {hotelItems.length > 0 ? (
                <div className="checkoutBuyer hotelGuestCheckoutSection">
                  <div className="checkoutSectionHeader">
                    <span className="checkoutStepEyebrow">HOME LIST / hotelaria</span>
                    <h3>Dados dos hóspedes</h3>
                    <p>
                      Os ingressos com hotel precisam desses dados para liberar a reserva após a aprovação do pagamento.
                    </p>
                  </div>
                  {hotelItems.map((item) => (
                    <div className="hotelGuestLotBlock" key={`hotel-${item.lot.id}`}>
                      <div className="hotelGuestLotHeader">
                        <strong>{item.lot.name}</strong>
                        {item.lot.hotel ? (
                          <span>
                            {item.lot.hotel.name} - {item.lot.hotel.city}/{item.lot.hotel.state}
                          </span>
                        ) : null}
                      </div>
                      {Array.from({ length: item.quantity }, (_, index) => {
                        const guestIndex = index + 1;
                        const prefix = `hotelGuest_${item.lot.id}_${guestIndex}`;

                        return (
                          <section className="hotelGuestCard" key={prefix}>
                            <input type="hidden" name={`${prefix}_enabled`} value="1" />
                            <h4>Hospedagem {guestIndex}</h4>
                            <div className="hotelGuestColumns">
                              <div>
                                <strong>Hóspede principal</strong>
                                <label className="field">
                                  <span>Nome completo</span>
                                  <input name={`${prefix}_guest1Name`} defaultValue={buyerProfile?.name || ""} required />
                                </label>
                                <label className="field">
                                  <span>CPF</span>
                                  <input name={`${prefix}_guest1Document`} inputMode="numeric" required />
                                </label>
                                <label className="field">
                                  <span>Data de nascimento</span>
                                  <input name={`${prefix}_guest1BirthDate`} type="date" required />
                                </label>
                                <label className="field">
                                  <span>E-mail</span>
                                  <input
                                    name={`${prefix}_guest1Email`}
                                    type="email"
                                    defaultValue={buyerProfile?.email || ""}
                                    required
                                  />
                                </label>
                                <label className="field">
                                  <span>Telefone</span>
                                  <input
                                    name={`${prefix}_guest1Phone`}
                                    type="tel"
                                    inputMode="tel"
                                    defaultValue={buyerProfile?.phone || ""}
                                    required
                                  />
                                </label>
                              </div>
                              <div>
                                <strong>Acompanhante / cônjuge</strong>
                                <label className="field">
                                  <span>Nome completo</span>
                                  <input name={`${prefix}_guest2Name`} required />
                                </label>
                                <label className="field">
                                  <span>CPF</span>
                                  <input name={`${prefix}_guest2Document`} inputMode="numeric" required />
                                </label>
                                <label className="field">
                                  <span>Data de nascimento</span>
                                  <input name={`${prefix}_guest2BirthDate`} type="date" required />
                                </label>
                              </div>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : null}

              <SubmitButton className="button fullButton" pendingText="Criando pedido...">
                Continuar para pagamento
              </SubmitButton>
              <p className="checkoutFootnote">
                Pagamento processado com confirmação automática. O ingresso com QR Code é liberado após a aprovação.
              </p>
            </form>
          </section>
        </div>
      </section>

      <PublicSiteFooter brandName={organizationContext.brandName} settings={publicSocialSettings} />
      {event.supportWhatsappUrl ? <WhatsappFloatingButton href={event.supportWhatsappUrl} /> : null}
    </main>
  );
}
