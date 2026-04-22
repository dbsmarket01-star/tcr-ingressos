import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/forms/CopyButton";
import { WhatsappFloatingButton } from "@/components/public/WhatsappFloatingButton";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getOrderByCode } from "@/features/orders/order.service";
import {
  approveSimulatedPaymentAction,
  failSimulatedPaymentAction,
  payWithCreditCardAction,
  startPaymentAction
} from "@/features/payments/payment.actions";
import { calculateCardInterestInCents } from "@/features/pricing/pricing";
import { formatCurrency, formatDateTime } from "@/lib/format";

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

const paymentStatusLabels = {
  CREATED: "Criado",
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
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

export default async function OrderPage({ params, searchParams }: OrderPageProps) {
  const { code } = await params;
  const query = searchParams ? await searchParams : {};
  const organizationContext = await getCurrentOrganizationContext();
  const order = await getOrderByCode(code);

  if (!order) {
    notFound();
  }

  const paymentError = typeof query.paymentError === "string" ? query.paymentError : null;
  const showPaymentSimulator =
    process.env.NODE_ENV !== "production" && process.env.SHOW_PAYMENT_SIMULATOR === "true";
  const isAsaasCheckout =
    process.env.PAYMENT_PROVIDER === "ASAAS" || order.payment?.provider === "ASAAS";
  const baseTotalInCents = order.subtotalInCents + order.serviceFeeInCents - order.discountInCents;
  const pixTotalInCents = Math.max(baseTotalInCents - order.pixDiscountInCents, 0);
  const installmentOptions = Array.from({ length: 10 }, (_, index) => index + 1).map((installment) => {
    const interestInCents = order.items.reduce(
      (sum, item) =>
        sum +
        calculateCardInterestInCents(
          item.totalInCents + item.serviceFeeInCents,
          installment,
          item.cardInterestBpsPerInstallment,
          item.cardInterestStartsAtInstallment
        ),
      0
    );
    const totalWithInterestInCents = baseTotalInCents + interestInCents;

    return {
      installment,
      interestInCents,
      totalWithInterestInCents,
      installmentValueInCents: Math.ceil(totalWithInterestInCents / installment)
    };
  });
  const eventHeroDate = formatDateTime(order.event.startsAt);
  const paymentStatusLabel = order.payment ? paymentStatusLabels[order.payment.status] : "Não iniciado";
  const ticketEmailStatusText = order.ticketsEmailSentAt
    ? `Ingressos enviados por e-mail em ${formatDateTime(order.ticketsEmailSentAt)}.`
    : "Assim que o pagamento for aprovado, enviaremos os ingressos automaticamente para o e-mail do comprador.";
  const orderLeadText =
    order.status === "PAID"
      ? "Pagamento confirmado. Seus ingressos já estão liberados e podem ser abertos individualmente logo abaixo."
      : order.status === "EXPIRED"
        ? "Este pedido expirou e a reserva voltou para o estoque. Para comprar, volte ao evento e gere um novo pedido."
        : "Seu pedido foi reservado. Escolha a forma de pagamento e conclua a compra para liberar os ingressos com QR Code.";

  return (
    <main className="shell">
      {order.event.googleTagManagerId ? (
        <>
          <Script id="tcr-order-gtm-script" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer',${JSON.stringify(order.event.googleTagManagerId)});
            `}
          </Script>
          <Script id="tcr-order-gtm-event" strategy="afterInteractive">
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
        <Script id="tcr-order-meta-pixel" strategy="afterInteractive">
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
          <span className="brandMark">{organizationContext.brandMark}</span>
          <span>{organizationContext.brandName}</span>
        </Link>
        <nav className="nav" aria-label="Navegação">
          <Link href={`/evento/${order.event.slug}`}>Voltar ao evento</Link>
        </nav>
      </header>

      <section className="container orderGrid">
        <article className="card">
          <div className="orderHeroBlock">
            <span className={`status ${orderStatusClasses[order.status]}`}>{orderStatusLabels[order.status]}</span>
            <h1>Pedido {order.code}</h1>
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
              <div>
                <span>Status do pagamento</span>
                <strong>{paymentStatusLabel}</strong>
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
            <div className="tableScroll">
              <table className="table orderItemsTable">
                <thead>
                  <tr>
                    <th>Ingresso</th>
                    <th>Quantidade</th>
                    <th>Unitário</th>
                    <th>Taxa</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.lot.name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unitPriceInCents)}</td>
                      <td>{formatCurrency(item.serviceFeeInCents)}</td>
                      <td>{formatCurrency(item.totalInCents + item.serviceFeeInCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {order.tickets.length > 0 ? (
            <div className="contentBlock">
              <h2>Ingressos emitidos</h2>
              <div className="ticketList">
                {order.tickets.map((ticket) => (
                  <Link className="ticketCard" href={`/ingresso/${ticket.code}`} key={ticket.id}>
                    <div>
                      <strong>{ticket.lot.name}</strong>
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
            <div className="summaryLine">
              <span>Ingressos</span>
              <strong>{formatCurrency(order.subtotalInCents)}</strong>
            </div>
            <div className="summaryLine">
              <span>Taxas e impostos</span>
              <strong>{formatCurrency(order.serviceFeeInCents)}</strong>
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
            {order.pixDiscountInCents > 0 ? (
              <div className="summaryLine">
                <span>Desconto no Pix</span>
                <strong>- {formatCurrency(order.pixDiscountInCents)}</strong>
              </div>
            ) : null}
            {order.cardInterestInCents > 0 ? (
              <div className="summaryLine">
                <span>Juros do cartão</span>
                <strong>{formatCurrency(order.cardInterestInCents)}</strong>
              </div>
            ) : null}
            <div className="summaryLine totalLine">
              <span>Total</span>
              <strong>{formatCurrency(order.totalInCents)}</strong>
            </div>
            <p className="summarySupportText">
              <strong>{order.customer.email}</strong>
              <br />
              {ticketEmailStatusText}
            </p>
          </div>

          <div className="paymentBox">
            <div className="paymentBoxHeader">
              <div>
                <h3>Pagamento</h3>
                <span>Escolha Pix ou cartão para concluir a compra com segurança.</span>
              </div>
              <strong>{formatCurrency(order.totalInCents)}</strong>
            </div>
            {paymentError ? <div className="errorBox">{paymentError}</div> : null}
            <div className="paymentStatusGrid compactPaymentStatus">
              <div>
                <span>Status</span>
                <strong>{paymentStatusLabel}</strong>
              </div>
            </div>
          </div>

          {order.status === "PENDING_PAYMENT" ? (
            <div className="paymentMethodStack">
              <div className="orderActionNote">
                <span>Próximo passo</span>
                <strong>Escolha a forma de pagamento para liberar seus ingressos.</strong>
                <p>
                  Depois da aprovação, o QR Code é liberado automaticamente e enviado para o e-mail do comprador.
                  {order.pixDiscountInCents > 0
                    ? ` No Pix, você economiza ${formatCurrency(order.pixDiscountInCents)} neste pedido.`
                    : ""}
                </p>
              </div>
              <div className="paymentSteps">
                <div>
                  <span>1</span>
                  <strong>Escolha a forma</strong>
                </div>
                <div>
                  <span>2</span>
                  <strong>Finalize com segurança</strong>
                </div>
                <div>
                  <span>3</span>
                  <strong>Receba os ingressos</strong>
                </div>
              </div>

              <div className="paymentChoiceList">
                <details className="paymentChoiceDisclosure" open={Boolean(order.payment?.pixQrCodePayload)}>
                  <summary>
                    <span>Pix</span>
                    <strong>{formatCurrency(pixTotalInCents)}</strong>
                    <small>QR Code e código copia e cola com confirmação automática</small>
                  </summary>
                  <div className="pixBox">
                    <div className="paymentChoiceHeader">
                      <div>
                        <h3>Pix</h3>
                        <span>Confirmação automática após o pagamento</span>
                      </div>
                      <strong>{formatCurrency(pixTotalInCents)}</strong>
                    </div>
                    {order.pixDiscountInCents > 0 ? (
                      <div className="paymentStatusGrid compactPaymentStatus">
                        <div>
                          <span>Total sem desconto</span>
                          <strong>{formatCurrency(baseTotalInCents)}</strong>
                        </div>
                        <div>
                          <span>Desconto no Pix</span>
                          <strong>- {formatCurrency(order.pixDiscountInCents)}</strong>
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
                  <details className="paymentChoiceDisclosure">
                    <summary>
                      <span>Cartão de crédito</span>
                      <strong>Ver parcelas</strong>
                      <small>Escolha as parcelas e confira os juros antes de confirmar</small>
                    </summary>
                    <form action={payWithCreditCardAction} className="cardForm">
                      <div className="cardFormHeader">
                        <div>
                          <h3>Cartão de crédito</h3>
                          <span>Pagamento seguro com aprovação automática</span>
                        </div>
                        <strong>{formatCurrency(baseTotalInCents)}</strong>
                      </div>
                      <div className="cardSecurityNote">
                        <span>Checkout transparente</span>
                        <span>Ambiente seguro de pagamento</span>
                        <span>Ingressos liberados após aprovação</span>
                      </div>
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
                                {option.interestInCents > 0
                                  ? ` - + ${formatCurrency(option.interestInCents)} juros`
                                  : " - sem juros"}
                              </option>
                            ))}
                          </select>
                          <small>
                            Os juros aparecem apenas quando a parcela configurada para este ingresso exigir acréscimo.
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
            <div className="paymentCompleteBox">
              <h3>Compra aprovada</h3>
              <p>
                Seus ingressos estão liberados. Apresente o QR Code na entrada do evento.
                {order.ticketsEmailSentAt ? ` ${ticketEmailStatusText}` : ""}
              </p>
              <div className="ticketList">
                {order.tickets.map((ticket) => (
                  <Link className="secondaryButton fullButton" href={`/ingresso/${ticket.code}`} key={ticket.id}>
                    Abrir ingresso {ticket.lot.name}
                  </Link>
                ))}
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
