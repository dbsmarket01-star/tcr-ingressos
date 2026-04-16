import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/forms/CopyButton";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { OrderCountdown } from "@/components/orders/OrderCountdown";
import { getOrderByCode } from "@/features/orders/order.service";
import {
  approveSimulatedPaymentAction,
  failSimulatedPaymentAction,
  payWithCreditCardAction,
  startPaymentAction,
  syncAsaasPaymentAction
} from "@/features/payments/payment.actions";
import { calculateCardInterestInCents } from "@/features/pricing/pricing";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

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
  const order = await getOrderByCode(code);

  if (!order) {
    notFound();
  }

  const paymentError = typeof query.paymentError === "string" ? query.paymentError : null;
  const baseTotalInCents = order.subtotalInCents + order.serviceFeeInCents - order.discountInCents;
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
          <span className="brandMark">T</span>
          <span>TCR Ingressos</span>
        </Link>
        <nav className="nav" aria-label="Navegacao">
          <Link href={`/evento/${order.event.slug}`}>Voltar ao evento</Link>
        </nav>
      </header>

      <section className="container orderGrid">
        <article className="card">
          <div className="orderHeroBlock">
            <span className={`status ${orderStatusClasses[order.status]}`}>{orderStatusLabels[order.status]}</span>
            <h1>Pedido {order.code}</h1>
            <p className="muted">
              {order.status === "EXPIRED"
                ? "Este pedido expirou e a reserva voltou para o estoque. Para comprar, volte ao evento e crie um novo pedido."
                : `Sua reserva foi criada. O estoque dos ingressos selecionados fica reservado ate ${
                    order.expiresAt ? formatDateTime(order.expiresAt) : "o prazo definido pela operacao"
                  }.`}
            </p>
          </div>
          {order.status === "PENDING_PAYMENT" && order.expiresAt ? (
            <OrderCountdown expiresAt={order.expiresAt.toISOString()} />
          ) : null}
          {order.status === "PAID" ? (
            <div className="successBox">
              Pagamento aprovado. Seus ingressos foram emitidos abaixo e tambem podem ser enviados por e-mail.
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

          {(order.utmSource || order.utmMedium || order.utmCampaign) ? (
            <div className="contentBlock">
              <h2>Origem da compra</h2>
              <p>
                <strong>{order.utmSource || "Origem nao informada"}</strong>
                {order.utmMedium ? ` / ${order.utmMedium}` : ""}
                {order.utmCampaign ? (
                  <>
                    <br />
                    <span className="muted">Campanha: {order.utmCampaign}</span>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          <div className="contentBlock">
            <h2>Itens do pedido</h2>
            <div className="tableScroll">
              <table className="table orderItemsTable">
                <thead>
                  <tr>
                    <th>Ingresso</th>
                    <th>Quantidade</th>
                    <th>Unitario</th>
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
              <span>Resumo do pedido</span>
              <strong>{order.event.title}</strong>
            </div>
            <div className="summaryLine">
              <span>Ingressos</span>
              <strong>{formatCurrency(order.subtotalInCents)}</strong>
            </div>
            <div className="summaryLine">
              <span>Taxas e impostos</span>
              <strong>{formatCurrency(order.serviceFeeInCents)}</strong>
            </div>
            <div className="summaryLine">
              <span>Desconto</span>
              <strong>
                {order.couponCode ? `${order.couponCode} - ` : ""}
                {formatCurrency(order.discountInCents)}
              </strong>
            </div>
            {order.cardInterestInCents > 0 ? (
              <div className="summaryLine">
                <span>Juros cartao</span>
                <strong>{formatCurrency(order.cardInterestInCents)}</strong>
              </div>
            ) : null}
            <div className="summaryLine totalLine">
              <span>Total</span>
              <strong>{formatCurrency(order.totalInCents)}</strong>
            </div>
          </div>

          <div className="paymentBox">
            <div className="paymentBoxHeader">
              <div>
                <h3>Pagamento</h3>
                <span>Escolha Pix ou cartao para concluir sua compra.</span>
              </div>
              <strong>{formatCurrency(order.totalInCents)}</strong>
            </div>
            {paymentError ? <div className="errorBox">{paymentError}</div> : null}
            <div className="paymentStatusGrid">
              <div>
                <span>Status</span>
                <strong>{order.payment ? paymentStatusLabels[order.payment.status] : "Nao iniciado"}</strong>
              </div>
              <div>
                <span>Provedor</span>
                <strong>{order.payment?.provider || "Nao iniciado"}</strong>
              </div>
              {order.payment?.externalId ? (
                <div>
                  <span>Referencia</span>
                  <strong className="breakText">{order.payment.externalId}</strong>
                </div>
              ) : null}
            </div>
          </div>

          {order.status === "PENDING_PAYMENT" ? (
            <div className="paymentMethodStack">
              <div className="paymentSteps">
                <div>
                  <span>1</span>
                  <strong>Escolha a forma</strong>
                </div>
                <div>
                  <span>2</span>
                  <strong>Pague com seguranca</strong>
                </div>
                <div>
                  <span>3</span>
                  <strong>Receba o QR Code</strong>
                </div>
              </div>
              {order.payment?.pixQrCodeImage && order.payment?.pixQrCodePayload ? (
                <div className="pixBox">
                <div className="paymentChoiceHeader">
                  <div>
                    <h3>Pix</h3>
                    <span>Confirmacao automatica apos o pagamento</span>
                  </div>
                  <strong>{formatCurrency(baseTotalInCents)}</strong>
                </div>
                  <ol className="paymentInstructionList">
                    <li>Abra o app do seu banco.</li>
                    <li>Escaneie o QR Code ou use o Pix copia e cola.</li>
                    <li>Apos a confirmacao, seus ingressos sao liberados automaticamente.</li>
                  </ol>
                  <img
                    alt="QR Code Pix para pagamento do pedido"
                    src={`data:image/png;base64,${order.payment.pixQrCodeImage}`}
                  />
                  {order.payment.pixExpiresAt ? (
                    <p className="muted">Valido ate {formatDateTime(order.payment.pixExpiresAt)}</p>
                  ) : null}
                  <label className="field">
                    <span>Pix copia e cola</span>
                    <textarea readOnly rows={5} value={order.payment.pixQrCodePayload} />
                  </label>
                  <CopyButton
                    className="secondaryButton fullButton"
                    copiedLabel="Codigo Pix copiado"
                    label="Copiar codigo Pix"
                    value={order.payment.pixQrCodePayload}
                  />
                </div>
              ) : null}
              <form action={startPaymentAction}>
                <input type="hidden" name="orderCode" value={order.code} />
                <SubmitButton className="button fullButton" pendingText="Preparando pagamento...">
                  {order.payment?.pixQrCodePayload
                    ? "Atualizar pagamento"
                    : order.payment?.checkoutUrl
                      ? "Abrir pagamento"
                      : "Continuar para pagamento"}
                </SubmitButton>
              </form>
              {order.payment?.provider === "ASAAS" && order.payment.externalId ? (
                <form action={syncAsaasPaymentAction}>
                  <input type="hidden" name="orderCode" value={order.code} />
                  <SubmitButton className="secondaryButton fullButton" pendingText="Verificando no Asaas...">
                    Verificar pagamento
                  </SubmitButton>
                </form>
              ) : null}
              {order.payment?.provider === "ASAAS" ? (
                <form action={payWithCreditCardAction} className="cardForm">
                  <div className="cardFormHeader">
                    <div>
                      <h3>Cartao de credito</h3>
                      <span>Pagamento seguro com confirmacao automatica</span>
                    </div>
                    <strong>{formatCurrency(baseTotalInCents)}</strong>
                  </div>
                  <div className="cardSecurityNote">
                    <span>Checkout transparente</span>
                    <span>Dados enviados com seguranca ao provedor</span>
                    <span>Ingressos liberados apos aprovacao</span>
                  </div>
                  <input type="hidden" name="orderCode" value={order.code} />

                  <div className="cardFormSection">
                    <h4>Dados do cartao</h4>
                    <label className="field">
                      <span>Numero do cartao</span>
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
                        <span>Mes</span>
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
                            {option.interestInCents > 0 ? ` - + ${formatCurrency(option.interestInCents)} juros` : " - sem juros"}
                          </option>
                        ))}
                      </select>
                      <small>
                        Juros aparecem apenas quando a parcela configurada para este ingresso exigir acrescimo.
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
                        <span>Numero</span>
                        <input name="holderAddressNumber" required />
                      </label>
                    </div>
                    <label className="field">
                      <span>Complemento</span>
                      <input name="holderAddressComplement" placeholder="Opcional" />
                    </label>
                  </div>

                  <SubmitButton className="button fullButton" pendingText="Processando cartao...">
                    Pagar com cartao agora
                  </SubmitButton>
                  <p className="checkoutFootnote">
                    A cobranca sera enviada para aprovacao automatica. Se o banco solicitar confirmacao, conclua no app do cartao.
                  </p>
                </form>
              ) : null}
              {order.payment?.provider === "SIMULATED" ? (
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
              <p>Seus ingressos estao liberados. Apresente o QR Code na entrada do evento.</p>
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
    </main>
  );
}
