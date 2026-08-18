import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { WhatsappFloatingButton } from "@/components/public/WhatsappFloatingButton";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { calculateCouponDiscountInCents, getValidCouponPreviewForEvent } from "@/features/coupons/coupon.service";
import { getBuyerProfile } from "@/features/customer-auth/google-buyer.service";
import { getCachedEventSeoBySlugInOrganization, getCachedPublicEventBySlugInOrganization } from "@/features/events/event.service";
import { getHotelRoomsPerUnit } from "@/features/hospitality/hotel-lot-rules";
import { createCheckoutOrderAction } from "@/features/orders/order.actions";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { calculateServiceFeeInCents, roundPublicPriceUpInCents } from "@/features/pricing/pricing";
import { buildEventSeo } from "@/features/seo/event-seo";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { listPaymentSplitRules } from "@/features/settings/split-settings.service";
import { calculateAsaasSplitsForOrder, sumAsaasSplitsInCents } from "@/features/payments/asaas-split.service";
import { getTrackingParamsFromSearch } from "@/features/tracking/tracking";
import { getPublicEventBranding } from "@/lib/event-branding";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { BuyerLocationFields } from "../BuyerLocationFields";
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

function getCheckoutQueryFields(query: Record<string, string | string[] | undefined>) {
  const ignoredKeys = new Set(["checkoutError", "coupon"]);
  const fields: Array<{ key: string; value: string }> = [];

  for (const [key, value] of Object.entries(query)) {
    if (ignoredKeys.has(key)) {
      continue;
    }

    allParams(value).forEach((entry) => {
      if (entry) {
        fields.push({ key, value: entry });
      }
    });
  }

  return fields;
}

function parseQuantity(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value) ?? 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.floor(parsed);
}

function getAvailableTypeOptions<T extends { status: string; soldQuantity: number; reservedQuantity: number }>(options: T[]) {
  return options.filter((option) => option.status === "ACTIVE" && option.soldQuantity + option.reservedQuantity === 0);
}

function getAvailableLotQuantity(lot: {
  hasTypeOptions: boolean;
  totalQuantity: number;
  soldQuantity: number;
  reservedQuantity: number;
  typeOptions: Array<{ status: string; soldQuantity: number; reservedQuantity: number }>;
}) {
  if (lot.hasTypeOptions) {
    return getAvailableTypeOptions(lot.typeOptions).length;
  }

  return Math.max(lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity, 0);
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
  const [event, buyerProfile, companySettings, splitRules] = await Promise.all([
    getCachedPublicEventBySlugInOrganization(slug, organizationContext.organization.id),
    getBuyerProfile(),
    getCompanySettingsByOrganizationId(organizationContext.organization.id),
    listPaymentSplitRules(organizationContext.organization.id)
  ]);

  if (!event) {
    notFound();
  }

  const now = new Date();
  const activeLots = event.lots.filter((lot) => {
    const startsOk = !lot.salesStartsAt || lot.salesStartsAt <= now;
    const endsOk = !lot.salesEndsAt || lot.salesEndsAt >= now;
    const hasStock = getAvailableLotQuantity(lot) > 0;
    return lot.status === "ACTIVE" && lot.saleBadge !== "SOLD_OUT" && startsOk && endsOk && hasStock;
  });
  const requestedLotIds = new Set(allParams(query.lotId).map((lotId) => lotId.trim()).filter(Boolean));
  const selectedItems = activeLots.flatMap((lot) => {
    if (!requestedLotIds.has(lot.id)) {
      return [];
    }

    const available = getAvailableLotQuantity(lot);
    const maxQuantity = Math.max(0, Math.min(lot.maxPerOrder, available));
    const selectedSeatIds = allParams(query[`seatId_${lot.id}`]).map((seatId) => seatId.trim()).filter(Boolean);
    const selectedTypeOptionId = firstParam(query[`lotOption_${lot.id}`])?.trim() || "";
    const selectedTypeOption = lot.hasTypeOptions
      ? getAvailableTypeOptions(lot.typeOptions).find((option) => option.id === selectedTypeOptionId) || null
      : null;
    const requestedQuantity = selectedSeatIds.length > 0
      ? selectedSeatIds.length
      : lot.hasTypeOptions
        ? (selectedTypeOption ? 1 : 0)
        : parseQuantity(query[`quantity_${lot.id}`]);
    const quantity = lot.hasTypeOptions ? requestedQuantity : Math.min(Math.max(requestedQuantity, 0), maxQuantity);

    if (quantity <= 0) {
      return [];
    }

    const serviceFeeInCents = calculateServiceFeeInCents(lot.priceInCents, quantity, lot.serviceFeeBps);
    const subtotalInCents = lot.priceInCents * quantity;

    return [{
      lot,
      lotOption: selectedTypeOption,
      quantity,
      serviceFeeInCents,
      seatIds: selectedSeatIds,
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
  const totalQrCodes = selectedItems.reduce(
    (sum, item) => sum + item.quantity * Math.max(item.lot.admissionsPerUnit, 1),
    0
  );
  const hotelItems = selectedItems.filter((item) => item.lot.hasHotel);
  const asksChurchName = selectedItems.some((item) => item.lot.churchQuestionEnabled);
  const ticketsTotalInCents = selectedItems.reduce((sum, item) => sum + item.subtotalInCents, 0);
  const initialCheckoutSplits = calculateAsaasSplitsForOrder(selectedItems.map((item) => ({ quantity: item.quantity, totalInCents: item.subtotalInCents })), splitRules);
  const configuredServiceFeeTotalInCents = selectedItems.reduce((sum, item) => sum + item.serviceFeeInCents, 0);
  const unroundedServiceFeeTotalInCents = Math.max(configuredServiceFeeTotalInCents, sumAsaasSplitsInCents(initialCheckoutSplits)) + companySettings.pixTransactionFeeInCents;
  const orderTotalInCents = roundPublicPriceUpInCents(ticketsTotalInCents + unroundedServiceFeeTotalInCents);
  const serviceFeeTotalInCents = orderTotalInCents - ticketsTotalInCents;
  const requestedCouponCode = firstParam(query.coupon)?.trim() || "";
  let couponPreview:
    | {
        code: string;
        discountInCents: number;
        percentage: number | null;
        totalInCents: number;
        type: string;
      }
    | null = null;
  let couponPreviewError: string | null = null;

  if (event.couponsEnabled && requestedCouponCode) {
    try {
      const coupon = await getValidCouponPreviewForEvent(event.id, requestedCouponCode);
      const discountInCents = coupon
        ? calculateCouponDiscountInCents(
            coupon,
            orderTotalInCents,
            selectedItems.map((item) => ({
              ...item,
              totalInCents: item.subtotalInCents
            }))
          )
        : 0;

      couponPreview = {
        code: coupon?.code || requestedCouponCode,
        discountInCents,
        percentage: coupon?.type === "PERCENTAGE" ? coupon.percentage ?? 0 : null,
        type: coupon?.type || "",
        totalInCents: Math.max(orderTotalInCents - discountInCents, 0)
      };
    } catch {
      couponPreviewError = "Cupom inválido ou indisponível.";
    }
  }

  const checkoutQueryFields = getCheckoutQueryFields(query);
  const discountedCheckoutSplits = calculateAsaasSplitsForOrder(
    selectedItems.map((item) => ({ quantity: item.quantity, totalInCents: item.subtotalInCents })),
    splitRules,
    { discountInCents: couponPreview?.discountInCents ?? 0 }
  );
  const unroundedDisplayedServiceFeeInCents = Math.max(configuredServiceFeeTotalInCents, sumAsaasSplitsInCents(discountedCheckoutSplits)) + companySettings.pixTransactionFeeInCents;
  const displayedTotalInCents = roundPublicPriceUpInCents(
    ticketsTotalInCents - (couponPreview?.discountInCents ?? 0) + unroundedDisplayedServiceFeeInCents
  );
  const displayedServiceFeeInCents = displayedTotalInCents - ticketsTotalInCents + (couponPreview?.discountInCents ?? 0);
  if (couponPreview) {
    couponPreview.totalInCents = displayedTotalInCents;
  }
  const displayedFeeAdjustmentInCents = displayedServiceFeeInCents - selectedItems.reduce((sum, item) => sum + item.serviceFeeInCents, 0);
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
            <div className="checkoutCartHeader">
              <span className="eyebrow">Seu carrinho</span>
              <h1>{event.title}</h1>
              <div className="zeroFeeCheckoutMessage">
                <strong>Taxa zero</strong>
                <span>Este é o preço final no Pix. Nenhuma taxa será acrescentada no checkout.</span>
              </div>
              <div className="checkoutCartMeta" aria-label="Data e local do evento">
                <span>{formatDateTime(event.startsAt)}</span>
                <span>
                  {event.venueName} - {event.city}, {event.state}
                </span>
              </div>
            </div>
            <div className="checkoutCartItems">
              {selectedItems.map((item, index) => {
                const displayedItemFeeInCents = item.serviceFeeInCents + (index === 0 ? displayedFeeAdjustmentInCents : 0);
                return (
                <div className="checkoutCartItem" key={item.lot.id}>
                  <div>
                    <strong>
                      {item.quantity}x {item.lot.name}
                    </strong>
                    {item.lotOption ? <span>{item.lotOption.label}</span> : null}
                    {item.seatIds.length > 0 ? <span>{item.seatIds.length} lugar(es) numerado(s)</span> : null}
                    <span>
                      Preço final
                    </span>
                    {item.lot.admissionsPerUnit > 1 ? (
                      <small>{item.quantity * item.lot.admissionsPerUnit} QR Codes individuais inclusos</small>
                    ) : null}
                  </div>
                  <strong>{formatCurrency(item.subtotalInCents + displayedItemFeeInCents)}</strong>
                </div>
                );
              })}
            </div>
            <div className="checkoutCartTotal">
              {couponPreview ? (
                <div>
                  <span>Desconto</span>
                  <strong>- {formatCurrency(couponPreview.discountInCents)}</strong>
                </div>
              ) : null}
              <div>
                <span>Preço final</span>
                <strong>{formatCurrency(couponPreview ? couponPreview.totalInCents : displayedTotalInCents)}</strong>
              </div>
            </div>
            {event.couponsEnabled ? (
              <div className="checkoutCartCoupon">
                <div>
                  <span className="checkoutCartCouponLabel">Cupom de desconto</span>
                  <p>Digite o código e clique em aplicar para ver o desconto no resumo.</p>
                </div>
                <form action={`/evento/${event.slug}/checkout`} className="checkoutCartCouponApplyForm" method="GET">
                  {checkoutQueryFields.map((field, index) => (
                    <input key={`${field.key}-${index}`} type="hidden" name={field.key} value={field.value} />
                  ))}
                  <label className="checkoutCartCouponField">
                    <span>Código do cupom</span>
                    <input
                      name="coupon"
                      placeholder="Ex: PROMO10"
                      defaultValue={requestedCouponCode}
                      autoCapitalize="characters"
                      autoComplete="off"
                    />
                  </label>
                  <button className="button checkoutCartCouponButton" type="submit">Aplicar cupom</button>
                </form>
                {couponPreview ? (
                  <div className="checkoutCouponApplied">
                    <div>
                      <span>
                        Cupom {couponPreview.code} aplicado: desconto de {formatCurrency(couponPreview.discountInCents)}.
                      </span>
                      <small>Total atualizado: {formatCurrency(couponPreview.totalInCents)}</small>
                    </div>
                    <strong>- {formatCurrency(couponPreview.discountInCents)}</strong>
                  </div>
                ) : null}
                {couponPreviewError ? <div className="checkoutCouponError">{couponPreviewError}</div> : null}
              </div>
            ) : null}
            <Link className="secondaryButton fullButton" href={`/evento/${event.slug}#ingressos`}>
              Alterar ingressos
            </Link>
          </aside>

          <section className="checkoutRegistrationPanel" id="cadastro">
            <div className="checkoutPanelHeader">
              <span className="checkoutStepEyebrow">Etapa 2 de 2</span>
              <h2>Dados do comprador</h2>
              <p>
                Informe os dados de quem receberá {totalQrCodes > 1 ? "os QR Codes" : totalQuantity > 1 ? "os ingressos" : "o ingresso"}. Você poderá
                revisar o pedido antes do pagamento.
              </p>
            </div>

            <form id="checkoutRegistrationForm" action={createCheckoutOrderAction} className="form checkoutRegistrationForm">
              <ErrorNotice message={checkoutError} />
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="eventSlug" value={event.slug} />
              <input type="hidden" name="utmSource" value={tracking.utmSource ?? ""} />
              <input type="hidden" name="utmMedium" value={tracking.utmMedium ?? ""} />
              <input type="hidden" name="utmCampaign" value={tracking.utmCampaign ?? ""} />
              <input type="hidden" name="utmContent" value={tracking.utmContent ?? ""} />
              <input type="hidden" name="utmTerm" value={tracking.utmTerm ?? ""} />
              <input type="hidden" name="referrer" value={tracking.referrer ?? ""} />
              <input type="hidden" name="landingPage" value={landingPage ?? ""} />
              {couponPreview ? <input type="hidden" name="coupon" value={couponPreview.code} /> : null}
              {selectedItems.map((item) => (
                <div key={item.lot.id}>
                  <input type="hidden" name="lotId" value={item.lot.id} />
                  {item.lotOption ? (
                    <input type="hidden" name={`lotOption_${item.lot.id}`} value={item.lotOption.id} />
                  ) : null}
                  <input type="hidden" name={`quantity_${item.lot.id}`} value={item.quantity} />
                  {item.lot.hasHotel ? (
                    <input
                      type="hidden"
                      name={`hotelRoomCount_${item.lot.id}`}
                      value={item.quantity * getHotelRoomsPerUnit(item.lot)}
                    />
                  ) : null}
                  {item.seatIds.map((seatId) => (
                    <input key={seatId} type="hidden" name={`seatId_${item.lot.id}`} value={seatId} />
                  ))}
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
                    placeholder="123.456.789-43"
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
                    placeholder="1194444-2222"
                  />
                  <small>Usado apenas para suporte do pedido, caso seja necessário.</small>
                </label>
                <BuyerLocationFields
                  defaultCity={firstParam(query.buyerCity) || ""}
                  defaultNeighborhood={firstParam(query.buyerNeighborhood) || ""}
                  defaultPostalCode={firstParam(query.buyerPostalCode) || ""}
                  defaultState={firstParam(query.buyerState) || ""}
                />
                {asksChurchName ? (
                  <label className="field">
                    <span>Você é de alguma igreja? Qual? <small>(opcional)</small></span>
                    <input
                      name="churchName"
                      autoComplete="organization"
                      defaultValue={firstParam(query.churchName) || ""}
                      placeholder="Ex.: Igreja Batista Central"
                    />
                    <small>
                      Se você vem por uma igreja parceira, informe aqui para organizarmos os grupos. Você pode deixar em branco.
                    </small>
                  </label>
                ) : null}
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
                      {Array.from({ length: item.quantity * getHotelRoomsPerUnit(item.lot) }, (_, index) => {
                        const guestIndex = index + 1;
                        const prefix = `hotelGuest_${item.lot.id}_${guestIndex}`;

                        return (
                          <section className="hotelGuestCard" key={prefix}>
                            <input type="hidden" name={`${prefix}_enabled`} value="1" />
                            <h4>Hospedagem {guestIndex}</h4>
                            <div className="hotelGuestColumns">
                              <div className="hotelGuestPerson hotelGuestPersonPrimary">
                                <strong>Hóspede principal</strong>
                                <label className="field">
                                  <span>Nome completo</span>
                                  <input name={`${prefix}_guest1Name`} defaultValue={buyerProfile?.name || ""} required />
                                </label>
                                <label className="field">
                                  <span>CPF</span>
                                  <input name={`${prefix}_guest1Document`} inputMode="numeric" placeholder="123.456.789-43" required />
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
                                    placeholder="1194444-2222"
                                    required
                                  />
                                </label>
                              </div>
                              <div className="hotelGuestPerson hotelGuestPersonCompanion">
                                <strong>Acompanhante / cônjuge</strong>
                                <label className="field">
                                  <span>Nome completo</span>
                                  <input name={`${prefix}_guest2Name`} required />
                                </label>
                                <label className="field">
                                  <span>CPF</span>
                                  <input name={`${prefix}_guest2Document`} inputMode="numeric" placeholder="123.456.789-43" required />
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
