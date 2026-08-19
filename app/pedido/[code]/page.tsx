import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/forms/CopyButton";
import { OrderStatusWatcher } from "@/components/orders/OrderStatusWatcher";
import { WhatsappFloatingButton } from "@/components/public/WhatsappFloatingButton";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getOrderByCode } from "@/features/orders/order.service";
import {
  approveSimulatedPaymentAction,
  failSimulatedPaymentAction,
  payWithCreditCardAction,
  resendApprovedTicketsEmailAction,
  startPaymentAction
} from "@/features/payments/payment.actions";
import {
  MIN_CARD_INSTALLMENT_AMOUNT_IN_CENTS,
  capDiscountToPayableAmount
} from "@/features/pricing/pricing";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getCreditCardInstallmentLimitForEvent } from "@/lib/payment-installments";
import { getCompanySettings } from "@/features/settings/company-settings.service";
import { listPaymentSplitRules } from "@/features/settings/split-settings.service";
import { calculateAsaasSplitsForOrder, sumAsaasSplitsInCents } from "@/features/payments/asaas-split.service";
import {
  calculateCardChargeInCents,
  calculateNetTicketAmountInCents,
  calculatePixChargeInCents
} from "@/features/payments/payment-fee-calculator";
import {
  getEffectivePaymentFeeSettings,
  isFeeFreeOrganization
} from "@/features/pricing/organization-pricing-policy";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

type OrderPageProps = {
  params: Promise<{
    code: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const orderStatusLabels = {
  DRAFT: "Rascunho",
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado"
};

const orderStatusClasses = {
  DRAFT: "draft",
  PENDING_PAYMENT: "pending",
  PAID: "paid",
  CANCELED: "canceled",
  EXPIRED: "canceled",
  REFUNDED: "draft"
};

function formatLotDisplayName(lotName: string, optionLabel?: string | null) {
  return optionLabel ? `${lotName} - ${optionLabel}` : lotName;
}

export default async function OrderPage({ params, searchParams }: OrderPageProps) {
  const { code } = await params;
  const query = searchParams ? await searchParams : {};
  const organizationContext = await getCurrentOrganizationContext();
  const order = await getOrderByCode(code, organizationContext.organization.id);

  if (!order) {
    notFound();
  }

  const [storedFeeSettings, storedSplitRules] = await Promise.all([
    getCompanySettings(order.event.organizationId),
    listPaymentSplitRules(order.event.organizationId)
  ]);
  const isFeeFree = isFeeFreeOrganization(order.event.organization.slug);
  const feeSettings = getEffectivePaymentFeeSettings(order.event.organization.slug, storedFeeSettings);
  const splitRules = isFeeFree ? [] : storedSplitRules;
  const effectiveOrderServiceFeeInCents = isFeeFree ? 0 : order.serviceFeeInCents;

  const paymentError = typeof query.paymentError === "string" ? query.paymentError : null;
  const paymentErrorMethod = query.paymentMethod === "pix" ? "pix" : "card";
  const ticketEmailStatus = query.ticketEmail === "sent" || query.ticketEmail === "error" ? query.ticketEmail : null;
  const ticketEmailMessage = typeof query.ticketEmailMessage === "string" ? query.ticketEmailMessage : null;
  const showPaymentSimulator =
    process.env.NODE_ENV !== "production" && process.env.SHOW_PAYMENT_SIMULATOR === "true";
  const isAsaasCheckout =
    process.env.PAYMENT_PROVIDER === "ASAAS" || order.payment?.provider === "ASAAS";
  const baseTotalInCents = order.subtotalInCents + effectiveOrderServiceFeeInCents - order.discountInCents;
  const pixDiscountInCents = capDiscountToPayableAmount(Math.max(order.subtotalInCents - order.discountInCents, 0), order.pixDiscountInCents);
  const pixTicketDiscountInCents = order.discountInCents + pixDiscountInCents;
  const pixSplits = calculateAsaasSplitsForOrder(order.items, splitRules, { discountInCents: pixTicketDiscountInCents });
  const pixNetTicketInCents = calculateNetTicketAmountInCents(order.subtotalInCents, pixTicketDiscountInCents);
  const pixSplitTotalInCents = sumAsaasSplitsInCents(pixSplits);
  const configuredPixFeeWithoutFixedInCents = Math.max(
    effectiveOrderServiceFeeInCents - feeSettings.pixTransactionFeeInCents,
    pixSplitTotalInCents
  );
  const pixTotalInCents = calculatePixChargeInCents(pixNetTicketInCents, configuredPixFeeWithoutFixedInCents, feeSettings);
  const maxCreditCardInstallments = getCreditCardInstallmentLimitForEvent(order.event);
  const hasPixPayload = Boolean(order.payment?.pixQrCodePayload);
  const shouldOpenCreditCard = Boolean(paymentError && paymentErrorMethod === "card");
  const shouldOpenPix = Boolean(hasPixPayload || paymentErrorMethod === "pix" || !paymentError);
  const installmentOptions = Array.from({ length: maxCreditCardInstallments }, (_, index) => index + 1)
    .map((installment) => {
      const cardSplits = calculateAsaasSplitsForOrder(order.items, splitRules, {
        discountInCents: order.discountInCents,
        installments: installment
      });
      const netTicketInCents = calculateNetTicketAmountInCents(order.subtotalInCents, order.discountInCents);
      const splitTotalInCents = sumAsaasSplitsInCents(cardSplits);
      const configuredCardFeeInCents = Math.max(
        effectiveOrderServiceFeeInCents - feeSettings.pixTransactionFeeInCents,
        splitTotalInCents
      );
      const totalWithInterestInCents = calculateCardChargeInCents(netTicketInCents, configuredCardFeeInCents, installment, feeSettings);
      const interestInCents = Math.max(totalWithInterestInCents - netTicketInCents - configuredCardFeeInCents, 0);

      return {
        installment,
        interestInCents,
        totalWithInterestInCents,
        installmentValueInCents: Math.ceil(totalWithInterestInCents / installment)
      };
    })
    .filter((option) => option.installmentValueInCents >= MIN_CARD_INSTALLMENT_AMOUNT_IN_CENTS);
  const eventHeroDate = formatDateTime(order.event.startsAt);
  const ticketEmailStatusText = order.ticketsEmailDeliveredAt
    ? `Ingressos entregues por e-mail em ${formatDateTime(order.ticketsEmailDeliveredAt)}.`
    : order.ticketsEmailSentAt
      ? `Ingressos enviados por e-mail em ${formatDateTime(order.ticketsEmailSentAt)}.`
      : "Assim que o pagamento for aprovado, enviaremos os ingressos automaticamente para o e-mail do comprador.";
  const orderHeroTitle =
    order.status === "PAID"
      ? "Compra aprovada"
      : order.status === "EXPIRED"
        ? "Pedido expirado"
        : "Pedido reservado";
  const orderLeadText =
    order.status === "PAID"
      ? "Pagamento confirmado. Seus ingressos já estão liberados e podem ser abertos individualmente logo abaixo."
      : order.status === "EXPIRED"
        ? "Este pedido expirou e a reserva voltou para o estoque. Para comprar, volte ao evento e gere um novo pedido."
        : "Escolha Pix ou cartão de crédito para concluir a compra e liberar os ingressos com QR Code.";

  return (
    <main className="shell">
      <OrderStatusWatcher
        code={order.code}
        initialStatus={order.status}
        initialPaymentStatus={order.payment?.status}
      />
      {order.event.googleTagManagerId ? (
        <>
          <Script id="public-order-gtm-script" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer',${JSON.stringify(order.event.googleTagManagerId)});
            `}
          </Script>
          <Script id="public-order-gtm-event" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              window.dataLayer.push({
                event: ${JSON.stringify(order.status === "PAID" ? "purchase" : "order_created")},
                event_id: ${JSON.stringify(order.code)},
                order_code: ${JSON.stringify(order.code)},
                event_name: ${JSON.stringify(order.event.title)},
                event_slug: ${JSON.stringify(order.event.slug)},
                value: ${order.totalInCents / 100},
                currency: "BRL",
                utm_source: ${JSON.stringify(order.utmSource)},
                utm_medium: ${JSON.stringify(order.utmMedium)},
                utm_campaign: ${JSON.stringify(order.utmCampaign)}
              });
            `}
          </Script>
        </>
      ) : null}
      {order.event.metaPixelId ? (
        <Script id="public-order-meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', ${JSON.stringify(order.event.metaPixelId)});
            fbq('track', 'PageView');
            fbq('track', ${JSON.stringify(order.status === "PAID" ? "Purchase" : "InitiateCheckout")}, {
              value: ${order.totalInCents / 100},
              currency: "BRL",
              content_name: ${JSON.stringify(order.event.title)},
              order_code: ${JSON.stringify(order.code)}
            }, { eventID: ${JSON.stringify(order.code)} });
          `}
        </Script>
      ) : null}
      <header className="topbar">
        <Link className="brand" href="/">
          {organizationContext.brandLogoUrl ? (
            <img alt={organizationContext.brandName} className="brandLogo" src={organizationContext.brandLogoUrl} />
          ) : (
            <span className="brandMark">{organizationContext.brandMark}</span>
          )}
          {!organizationContext.brandLogoUrl ? <span>{organizationContext.brandName}</span> : null}
        </Link>
        <nav className="nav" aria-label="Navegação">
          <Link href={`/evento/${order.event.slug}`}>Voltar ao evento</Link>
        </nav>
      </header>

      <section className="container orderGrid">
        {paymentError ? (
          <section className="paymentErrorBanner" id="aviso-pagamento" role="alert" tabIndex={-1}>
            <div className="paymentErrorIcon" aria-hidden="true">
              !
            </div>
            <div className="paymentErrorCopy">
              <span>{paymentErrorMethod === "pix" ? "Pix não gerado" : "Pagamento não aprovado"}</span>
              <h2>{paymentErrorMethod === "pix" ? "Não conseguimos gerar o Pix desta compra." : "Seu cartão não autorizou esta compra."}</h2>
              {paymentErrorMethod === "pix" ? (
                <p>
                  Nenhuma cobrança foi criada. Revise o valor do pedido e tente gerar o Pix novamente. Se o problema persistir, fale com o suporte do evento.
                </p>
              ) : (
                <p>
                  Nenhuma cobrança foi concluída. Confira os dados do cartão, limite disponível ou autorização no app do banco.
                  Você também pode tentar outro cartão ou pagar via Pix.
                </p>
              )}
              <small>Retorno do banco: {paymentError}</small>
            </div>
            <a className="secondaryButton paymentErrorAction" href={paymentErrorMethod === "pix" ? "#pix" : "#cartao-de-credito"}>
              {paymentErrorMethod === "pix" ? "Gerar Pix novamente" : "Tentar novamente"}
            </a>
          </section>
        ) : null}

        <article className="card">
          <div className="orderHeroBlock">
            <span className={`status ${orderStatusClasses[order.status]}`}>{orderStatusLabels[order.status]}</span>
            <h1>{orderHeroTitle}</h1>
            <p className="orderCodeLine">Pedido {order.code}</p>
            <p className="muted">{orderLeadText}</p>
            <div className="orderHeroMeta">
              <div>
                <span>Evento</span>
                <strong>{order.event.title}</strong>
              </div>
              <div>
                <span>Data</span>
                <strong>{eventHeroDate}</strong>
              </div>
            </div>
          </div>
          {order.status === "PAID" ? (
            <div className="successBox">
              Pagamento aprovado. Seus ingressos foram emitidos abaixo e também podem ser enviados por e-mail.
            </div>
          ) : null}

          <div className="contentBlock">
            <h2>Comprador</h2>
            <p>
              <strong>{order.customer.name}</strong>
              <br />
              <span className="muted">{order.customer.email}</span>
            </p>
          </div>

          <div className="contentBlock">
            <h2>Itens do pedido</h2>
            <div className="orderItemsList">
              {order.items.map((item) => (
                <div className="orderItemLine" key={item.id}>
                  <div>
                    <strong>{formatLotDisplayName(item.lot.name, item.lotOption?.label)}</strong>
                    <span>
                      {item.quantity}x • preço final
                    </span>
                  </div>
                  <strong>{formatCurrency(item.totalInCents + (isFeeFree ? 0 : item.serviceFeeInCents))}</strong>
                </div>
              ))}
            </div>
          </div>

          {order.tickets.length > 0 ? (
            <div className="contentBlock">
              <h2>Ingressos emitidos</h2>
              <div className="ticketList">
                {order.tickets.map((ticket) => (
                  <Link className="ticketCard" href={`/ingresso/${ticket.code}`} key={ticket.id}>
                    <div>
                      <strong>{formatLotDisplayName(ticket.lot.name, ticket.lotOption?.label)}</strong>
                      <span className="muted">{ticket.code}</span>
                    </div>
                    <span className={`status ${ticket.status === "ACTIVE" ? "published" : "draft"}`}>
                      {ticket.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <aside className="purchasePanel orderPaymentPanel">
          <div className="orderSummaryBox">
            <div>
              <span>Resumo da compra</span>
              <strong>{order.event.title}</strong>
              <small>{eventHeroDate}</small>
            </div>
            {order.discountInCents > 0 ? (
              <div className="summaryLine">
                <span>Desconto</span>
                <strong>
                  {order.couponCode ? `${order.couponCode} - ` : ""}
                  {formatCurrency(order.discountInCents)}
                </strong>
              </div>
            ) : null}
            {order.cardInterestInCents > 0 ? (
              <div className="summaryLine">
                <span>Juros do cartão</span>
                <strong>{formatCurrency(order.cardInterestInCents)}</strong>
              </div>
            ) : null}
            <div className="summaryLine totalLine">
              <span>Preço final</span>
              <strong>{formatCurrency(isFeeFree && order.status === "PENDING_PAYMENT" ? baseTotalInCents : order.totalInCents)}</strong>
            </div>
            <p className="summarySupportText">
              <strong>{order.customer.email}</strong>
              <br />
              {ticketEmailStatusText}
            </p>
          </div>

          <div className="paymentBox" id="formas-de-pagamento">
            <div className="paymentBoxHeader">
              <div>
                <h3>Forma de pagamento</h3>
                <span>Escolha uma opção para liberar seus ingressos automaticamente após aprovação.</span>
              </div>
            </div>
          </div>

          {order.status === "PENDING_PAYMENT" ? (
            <div className="paymentMethodStack">
              <div className="paymentChoiceList">
                <details className="paymentChoiceDisclosure" id="pix" open={shouldOpenPix}>
                  <summary data-open-label="Abrir Pix">
                    <span>Pix</span>
                    <strong>{formatCurrency(pixTotalInCents)}</strong>
                    <small>
                      QR Code ou copia e cola.
                      {pixDiscountInCents > 0 ? ` Economize ${formatCurrency(pixDiscountInCents)}.` : ""}
                    </small>
                  </summary>
                  <div className="pixBox">
                    <div className="paymentChoiceHeader">
                      <div>
                        <h3>Pix</h3>
                        <span>Confirmação automática após o pagamento</span>
                      </div>
                      <strong>{formatCurrency(pixTotalInCents)}</strong>
                    </div>
                    {pixDiscountInCents > 0 ? (
                      <div className="paymentStatusGrid compactPaymentStatus">
                        <div>
                          <span>Total sem desconto</span>
                          <strong>{formatCurrency(baseTotalInCents)}</strong>
                        </div>
                        <div>
                          <span>Desconto no Pix</span>
                          <strong>- {formatCurrency(pixDiscountInCents)}</strong>
                        </div>
                        <div>
                          <span>Total no Pix</span>
                          <strong>{formatCurrency(pixTotalInCents)}</strong>
                        </div>
                      </div>
                    ) : null}
                    {order.payment?.pixQrCodeImage && order.payment?.pixQrCodePayload ? (
                      <>
                        <ol className="paymentInstructionList">
                          <li>Abra o app do seu banco.</li>
                          <li>Escaneie o QR Code ou use o Pix copia e cola.</li>
                          <li>Após a confirmação, seus ingressos são liberados automaticamente.</li>
                        </ol>
                        <img
                          alt="QR Code Pix para pagamento do pedido"
                          src={`data:image/png;base64,${order.payment.pixQrCodeImage}`}
                        />
                        {order.payment.pixExpiresAt ? (
                          <p className="muted">Válido até {formatDateTime(order.payment.pixExpiresAt)}</p>
                        ) : null}
                        <label className="field">
                          <span>Pix copia e cola</span>
                          <textarea readOnly rows={5} value={order.payment.pixQrCodePayload} />
                        </label>
                        <CopyButton
                          className="secondaryButton fullButton"
                          copiedLabel="Código Pix copiado"
                          label="Copiar código Pix"
                          value={order.payment.pixQrCodePayload}
                        />
                        <p className="checkoutFootnote">
                          A confirmação é automática. Depois de pagar, aguarde alguns instantes; seus ingressos serão liberados assim que o pagamento for aprovado.
                        </p>
                      </>
                    ) : (
                      <>
                        <ol className="paymentInstructionList">
                          <li>Clique em gerar Pix.</li>
                          <li>Na próxima tela, use o QR Code ou o código copia e cola.</li>
                          <li>Os ingressos são liberados automaticamente após a aprovação.</li>
                        </ol>
                        <form action={startPaymentAction}>
                          <input type="hidden" name="orderCode" value={order.code} />
                          <SubmitButton className="button fullButton" pendingText="Preparando Pix...">
                            Gerar Pix agora
                          </SubmitButton>
                        </form>
                      </>
                    )}
                  </div>
                </details>

                {isAsaasCheckout ? (
                  <details className="paymentChoiceDisclosure" id="cartao-de-credito" open={shouldOpenCreditCard}>
                    <summary data-open-label="Abrir cartão">
                      <span>Cartão de crédito</span>
                      <strong>Selecionar</strong>
                      <small>Escolha a quantidade de parcelas antes de confirmar</small>
                    </summary>
                    <form action={payWithCreditCardAction} className="cardForm">
                      <input type="hidden" name="orderCode" value={order.code} />

                      <div className="cardFormSection">
                        <h4>Dados do cartão</h4>
                        <label className="field">
                          <span>Número do cartão</span>
                          <input
                            autoComplete="cc-number"
                            inputMode="numeric"
                            name="number"
                            placeholder="0000 0000 0000 0000"
                            required
                          />
                        </label>
                        <div className="cardCompactGrid">
                          <label className="field">
                            <span>Mês</span>
                            <input
                              autoComplete="cc-exp-month"
                              inputMode="numeric"
                              maxLength={2}
                              name="expiryMonth"
                              placeholder="MM"
                              required
                            />
                          </label>
                          <label className="field">
                            <span>Ano</span>
                            <input
                              autoComplete="cc-exp-year"
                              inputMode="numeric"
                              maxLength={4}
                              name="expiryYear"
                              placeholder="AAAA"
                              required
                            />
                          </label>
                          <label className="field">
                            <span>CVV</span>
                            <input
                              autoComplete="cc-csc"
                              inputMode="numeric"
                              maxLength={4}
                              name="ccv"
                              placeholder="123"
                              required
                            />
                          </label>
                        </div>
                        <label className="field">
                          <span>Parcelas</span>
                          <select name="installments" defaultValue="1">
                            {installmentOptions.map((option) => (
                              <option key={option.installment} value={option.installment}>
                                {option.installment}x de {formatCurrency(option.installmentValueInCents)}
                                {option.interestInCents > 0 ? " - juros" : " - sem juros"}
                              </option>
                            ))}
                          </select>
                          <small>
                            O valor de cada parcela já inclui os juros aplicáveis.
                          </small>
                        </label>
                      </div>

                      <div className="cardFormSection">
                        <h4>Dados do titular</h4>
                        <label className="field">
                          <span>Nome do titular</span>
                          <input autoComplete="cc-name" name="holderName" required />
                        </label>
                        <label className="field">
                          <span>CPF/CNPJ do titular</span>
                          <input
                            inputMode="numeric"
                            name="holderCpfCnpj"
                            placeholder="123.456.789-43"
                            required
                            defaultValue={order.customer.document || ""}
                          />
                        </label>
                        <div className="addressWideGrid">
                          <label className="field">
                            <span>CEP</span>
                            <input
                              autoComplete="postal-code"
                              inputMode="numeric"
                              name="holderPostalCode"
                              placeholder="00000-000"
                              required
                            />
                          </label>
                          <label className="field">
                          <span>Número</span>
                            <input name="holderAddressNumber" required />
                          </label>
                        </div>
                        <label className="field">
                          <span>Complemento</span>
                          <input name="holderAddressComplement" placeholder="Opcional" />
                        </label>
                      </div>

                      <SubmitButton className="button fullButton" pendingText="Processando cartão...">
                        Pagar com cartão agora
                      </SubmitButton>
                      <p className="checkoutFootnote">
                        A cobrança será enviada para aprovação automática. Se o banco pedir confirmação, conclua no aplicativo do cartão.
                      </p>
                    </form>
                  </details>
                ) : null}
              </div>
              {showPaymentSimulator && order.payment?.provider === "SIMULATED" ? (
                <div className="paymentSimulator">
                  <span className="muted">Simulador de retorno do provedor</span>
                  <form action={approveSimulatedPaymentAction}>
                    <input type="hidden" name="orderCode" value={order.code} />
                    <button className="secondaryButton fullButton" type="submit">
                      Simular pagamento aprovado
                    </button>
                  </form>
                  <form action={failSimulatedPaymentAction}>
                    <input type="hidden" name="orderCode" value={order.code} />
                    <button className="secondaryButton fullButton" type="submit">
                      Simular falha no pagamento
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          ) : null}

          {order.status === "PAID" ? (
            <div className="paymentCompleteBox" id="ingressos">
              <div className="approvedStatusHeader">
                <span className="approvedStatusIcon" aria-hidden="true">
                  OK
                </span>
                <div className="approvedStatusCopy">
                  <span>Pagamento confirmado</span>
                  <h3>Compra aprovada</h3>
                  <p>Seus ingressos estão liberados para acesso ao evento.</p>
                </div>
              </div>
              {ticketEmailStatus ? (
                <div className={ticketEmailStatus === "sent" ? "paymentNotice success" : "paymentNotice error"}>
                  <strong>{ticketEmailStatus === "sent" ? "Envio por e-mail atualizado" : "Falha no envio por e-mail"}</strong>
                  <span>
                    {ticketEmailMessage ||
                      (ticketEmailStatus === "sent"
                        ? "Ingressos reenviados por e-mail."
                        : "Não foi possível reenviar os ingressos agora.")}
                  </span>
                </div>
              ) : null}
              <div className="approvedGuidanceGrid">
                <div className="approvedGuidanceCard">
                  <span>Entrada do evento</span>
                  <strong>Apresente o QR Code</strong>
                  <p>Cada ingresso possui um QR Code individual. Abra no celular ou leve impresso para validar na entrada.</p>
                </div>
                <div className="approvedGuidanceCard">
                  <span>Entrega por e-mail</span>
                  <strong>{order.tickets.length === 1 ? "1 ingresso liberado" : `${order.tickets.length} ingressos liberados`}</strong>
                  <p>{ticketEmailStatusText}</p>
                </div>
              </div>
              <div className="approvedTicketsPanel">
                <div className="approvedSectionHeader">
                  <span>Ingressos</span>
                  <strong>Abra o ingresso e apresente o QR Code no dia do evento.</strong>
                </div>
                <div className="approvedTicketList">
                  {order.tickets.map((ticket) => (
                    <Link className="approvedTicketLink" href={`/ingresso/${ticket.code}`} key={ticket.id}>
                      <span>Abrir ingresso</span>
                      <strong>{formatLotDisplayName(ticket.lot.name, ticket.lotOption?.label)}</strong>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="approvedResendPanel">
                <form action={resendApprovedTicketsEmailAction}>
                  <input type="hidden" name="orderCode" value={order.code} />
                  <SubmitButton className="secondaryButton fullButton" pendingText="Reenviando ingressos...">
                    Reenviar ingressos por e-mail
                  </SubmitButton>
                </form>
                <p className="checkoutFootnote">
                  Se não encontrar o e-mail, confira também spam, promoções e atualizações.
                </p>
              </div>
            </div>
          ) : null}
        </aside>
      </section>
      {order.status !== "PAID" && order.event.supportWhatsappUrl ? (
        <WhatsappFloatingButton href={order.event.supportWhatsappUrl} label="Precisa de ajuda?" />
      ) : null}
    </main>
  );
}
