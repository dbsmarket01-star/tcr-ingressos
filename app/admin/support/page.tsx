import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { CopyButton } from "@/components/forms/CopyButton";
import { requirePermission } from "@/features/auth/auth.service";
import { resendPendingPaymentEmailAction, resendTicketsEmailAction } from "@/features/support/support.actions";
import { searchSupportOrders } from "@/features/support/support.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type SupportPageProps = {
  searchParams: Promise<{
    q?: string;
    sent?: string;
    paymentSent?: string;
    order?: string;
    error?: string;
  }>;
};

const orderStatusLabels = {
  DRAFT: "Rascunho",
  PENDING_PAYMENT: "Pendente",
  PAID: "Pago",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado"
};

const ticketStatusLabels = {
  ACTIVE: "Ativo",
  USED: "Usado",
  CANCELED: "Cancelado",
  INVALID: "Inválido"
};

export default async function SupportPage({ searchParams }: SupportPageProps) {
  await requirePermission("SUPPORT");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const orders = await searchSupportOrders(query);
  const toWhatsappHref = (phone?: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (!digits) return null;
    return `https://wa.me/${digits}`;
  };

  return (
    <AdminShell
      title="Atendimento"
      description="Busque pedidos, clientes e ingressos para resolver suporte na hora."
    >
      <section className="card supportSearch">
        <form className="supportSearchForm">
          <label className="field">
            <span>Buscar por pedido, ingresso, nome, e-mail, telefone ou evento</span>
            <input
              name="q"
              placeholder="Ex: TCR-..., nome do cliente, e-mail ou código do ingresso"
              defaultValue={query}
            />
          </label>
          <button className="button" type="submit">
            Buscar
          </button>
          {query ? (
            <Link className="secondaryButton" href="/admin/support">
              Limpar
            </Link>
          ) : null}
        </form>
        <div className="supportSearchHints" aria-label="Exemplos de busca">
          <span>Pedido TCR-...</span>
          <span>E-mail do cliente</span>
          <span>CPF ou telefone</span>
          <span>Código do ingresso</span>
        </div>

        {params.sent ? (
          <p className="success">
            Ingressos do pedido {params.order} reenviados para {params.sent}.
          </p>
        ) : null}
        {params.paymentSent ? (
          <p className="success">
            Link de pagamento do pedido {params.order} reenviado para {params.paymentSent}.
          </p>
        ) : null}

        {params.error ? <p className="errorBox">{params.error}</p> : null}
      </section>

      <section className="grid supportResults">
        {orders.length === 0 ? (
          <div className="empty">
            {query
              ? "Nenhum resultado encontrado. Confira se o código, e-mail, telefone ou nome foi digitado corretamente."
              : "Digite um pedido, ingresso, nome, e-mail, telefone ou evento para iniciar o atendimento."}
          </div>
        ) : (
          orders.map((order) => (
            <article className="card supportOrderCard" key={order.id}>
              <div className="sectionHeader inlineHeader">
                <div>
                  <h2>{order.code}</h2>
                  <p className="muted">
                    {order.customer.name} - {order.customer.email}
                  </p>
                </div>
                <div className="supportHeaderActions">
                  <CopyButton className="secondaryButton smallButton" label="Copiar pedido" copiedLabel="Copiado" value={order.code} />
                  <span className={`status ${order.status === "PAID" ? "published" : "draft"}`}>
                    {orderStatusLabels[order.status]}
                  </span>
                </div>
              </div>

              <div className="supportSummaryGrid">
                <div>
                  <span>Evento</span>
                  <strong>{order.event.title}</strong>
                </div>
                <div>
                  <span>Pedido</span>
                  <strong>{order.code}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{formatCurrency(order.totalInCents)}</strong>
                </div>
                <div>
                  <span>Pagamento</span>
                  <strong>{order.payment?.status ?? "-"}</strong>
                </div>
                <div>
                  <span>Ingressos</span>
                  <strong>{order.tickets.length}</strong>
                </div>
                <div>
                  <span>Origem</span>
                  <strong>{order.utmSource || order.utmMedium ? `${order.utmSource ?? "-"} / ${order.utmMedium ?? "-"}` : "Direto"}</strong>
                </div>
                <div>
                  <span>Expira em</span>
                  <strong>{order.expiresAt ? formatDateTime(order.expiresAt) : "-"}</strong>
                </div>
                <div>
                  <span>Criado em</span>
                  <strong>{formatDateTime(order.createdAt)}</strong>
                </div>
              </div>

              <div className="supportDetailsGrid">
                <div>
                  <h3>Contato</h3>
                  <p>
                    <strong>{order.customer.name}</strong>
                    <br />
                    <span className="breakText">{order.customer.email}</span>
                    <br />
                    <span>{order.customer.phone ?? "Telefone não informado"}</span>
                  </p>
                  <div className="supportInlineCopies">
                    <CopyButton className="secondaryButton smallButton" label="Copiar e-mail" copiedLabel="Copiado" value={order.customer.email} />
                    {order.customer.phone ? (
                      <CopyButton className="secondaryButton smallButton" label="Copiar telefone" copiedLabel="Copiado" value={order.customer.phone} />
                    ) : null}
                    {toWhatsappHref(order.customer.phone) ? (
                      <a
                        className="secondaryButton smallButton"
                        href={toWhatsappHref(order.customer.phone) ?? undefined}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Abrir WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
                <div>
                  <h3>Itens</h3>
                  {order.items.map((item) => (
                    <p key={item.id}>
                      {item.quantity}x {item.lot.name} - {formatCurrency(item.totalInCents)}
                    </p>
                  ))}
                </div>
              </div>

              <div className="supportResolutionBox">
                <div>
                  <span>Situação sugerida</span>
                  <strong>
                    {order.status === "PAID"
                      ? "Cliente pode receber os ingressos."
                      : order.status === "PENDING_PAYMENT"
                        ? "Cliente ainda precisa concluir o pagamento."
                        : "Conferir histórico antes de orientar o cliente."}
                  </strong>
                </div>
                <div>
                  <span>Ação mais provável</span>
                  <strong>
                    {order.status === "PAID"
                      ? "Reenviar ingressos ou abrir QR Code."
                      : order.status === "PENDING_PAYMENT"
                        ? "Reenviar link de pagamento ou orientar no Pix."
                        : "Abrir o pedido interno e revisar o histórico."}
                  </strong>
                </div>
              </div>

              <div className="ticketList">
                <h3>Ingressos</h3>
                {order.tickets.length === 0 ? (
                  <p className="muted">Ingressos ainda não emitidos.</p>
                ) : (
                  order.tickets.map((ticket) => (
                    <Link className="ticketCard" href={`/ingresso/${ticket.code}`} key={ticket.id}>
                      <div>
                        <strong>{ticket.code}</strong>
                        <span className="muted">{ticket.lot.name}</span>
                      </div>
                      <div className="supportHeaderActions">
                        <CopyButton
                          className="secondaryButton smallButton"
                          label="Copiar"
                          copiedLabel="Copiado"
                          value={ticket.code}
                        />
                        <span className={`status ${ticket.status === "ACTIVE" ? "published" : "draft"}`}>
                          {ticketStatusLabels[ticket.status]}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              <div className="supportActions">
                <Link className="secondaryButton" href={`/pedido/${order.code}`}>
                  Abrir pedido
                </Link>
                <Link className="secondaryButton" href={`/admin/orders/${order.code}`}>
                  Detalhe interno
                </Link>
                <form action={resendPendingPaymentEmailAction}>
                  <input type="hidden" name="orderCode" value={order.code} />
                  <input type="hidden" name="query" value={query} />
                  <button className="secondaryButton" type="submit" disabled={order.status !== "PENDING_PAYMENT"}>
                    Reenviar pagamento
                  </button>
                </form>
                <form action={resendTicketsEmailAction}>
                  <input type="hidden" name="orderCode" value={order.code} />
                  <input type="hidden" name="query" value={query} />
                  <button className="button" type="submit" disabled={order.tickets.length === 0}>
                    Reenviar ingressos
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </AdminShell>
  );
}
