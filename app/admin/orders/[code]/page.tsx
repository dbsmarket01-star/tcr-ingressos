import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getAdminOrderDetail } from "@/features/orders/order-detail.service";
import { refundPaidOrderAction } from "@/features/orders/order.admin.actions";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type AdminOrderDetailPageProps = {
  params: Promise<{
    code: string;
  }>;
  searchParams?: Promise<{
    refunded?: string;
    released?: string;
    ticketsCanceled?: string;
    orderError?: string;
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

const paymentStatusLabels = {
  CREATED: "Criado",
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado"
};

const ticketStatusLabels = {
  ACTIVE: "Ativo",
  USED: "Usado",
  CANCELED: "Cancelado",
  INVALID: "Inválido"
};

export default async function AdminOrderDetailPage({ params, searchParams }: AdminOrderDetailPageProps) {
  await requirePermission("ORDERS");
  const { code } = await params;
  const query = searchParams ? await searchParams : {};
  const order = await getAdminOrderDetail(code);

  if (!order) {
    notFound();
  }

  const refundSuccess = query.refunded === "1";
  const orderError = typeof query.orderError === "string" ? query.orderError : null;

  return (
    <AdminShell
      title={`Pedido ${order.code}`}
      description="Visão operacional completa do pedido, pagamento, split, ingressos emitidos e check-in."
    >
      {refundSuccess ? (
        <div className="successBox spacedSection">
          Reembolso registrado com sucesso. {query.released ?? "0"} ingresso(s) voltaram ao estoque e{" "}
          {query.ticketsCanceled ?? "0"} ingresso(s) foram cancelado(s).
        </div>
      ) : null}
      {orderError ? <div className="errorBox spacedSection">{orderError}</div> : null}

      <section className="card orderMaintenance">
        <div>
          <h2>{order.event.title}</h2>
          <p className="muted">
            Criado em {formatDateTime(order.createdAt)}
            {order.paidAt ? ` • pago em ${formatDateTime(order.paidAt)}` : ""}
          </p>
        </div>
        <Link className="secondaryButton" href="/admin/orders">
          Voltar para pedidos
        </Link>
        <Link className="button" href={`/pedido/${order.code}`}>
          Ver tela do cliente
        </Link>
        {order.status === "PAID" ? (
          <form action={refundPaidOrderAction} className="inlineForm">
            <input type="hidden" name="orderCode" value={order.code} />
            <input type="hidden" name="refundReason" value="Reembolso registrado manualmente pelo painel administrativo." />
            <button className="secondaryButton" type="submit">
              Reembolsar e cancelar ingressos
            </button>
          </form>
        ) : null}
      </section>

      <section className="grid dashboardGrid">
        <article className="card metric">
          <span className="muted">Status do pedido</span>
          <strong>{orderStatusLabels[order.status]}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Pagamento</span>
          <strong>{order.payment ? paymentStatusLabels[order.payment.status] : "Não iniciado"}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Total</span>
          <strong>{formatCurrency(order.totalInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Split Asaas</span>
          <strong>{formatCurrency(order.splitSummary.totalInCents)}</strong>
        </article>
      </section>

      <section className="grid twoColumns spacedSection">
        <article className="card">
          <div className="sectionHeader inlineHeader">
            <h2>Comprador</h2>
          </div>
          <div className="financeStatusGrid">
            <div>
              <span>Nome</span>
              <strong>{order.customer.name}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong className="breakText">{order.customer.email}</strong>
            </div>
            <div>
              <span>Telefone</span>
              <strong>{order.customer.phone || "-"}</strong>
            </div>
            <div>
              <span>Documento</span>
              <strong>{order.customer.document || "-"}</strong>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader inlineHeader">
            <h2>Pagamento e rastreio</h2>
          </div>
          <div className="financeStatusGrid">
            <div>
              <span>Provedor</span>
              <strong>{order.payment?.provider || "-"}</strong>
            </div>
            <div>
              <span>Referência externa</span>
              <strong className="breakText">{order.payment?.externalId || "-"}</strong>
            </div>
            <div>
              <span>Origem</span>
              <strong>{order.utmSource || order.utmMedium ? `${order.utmSource ?? "-"} / ${order.utmMedium ?? "-"}` : "Direto"}</strong>
            </div>
            <div>
              <span>Campanha</span>
              <strong>{order.utmCampaign || "-"}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Resumo financeiro</h2>
        </div>
        <div className="financeStatusGrid">
          <div>
            <span>Ingressos</span>
            <strong>{formatCurrency(order.subtotalInCents)}</strong>
          </div>
          <div>
            <span>Taxas e impostos</span>
            <strong>{formatCurrency(order.serviceFeeInCents)}</strong>
          </div>
          <div>
            <span>Juros do cartão</span>
            <strong>{formatCurrency(order.cardInterestInCents)}</strong>
          </div>
          <div>
            <span>Desconto</span>
            <strong>{formatCurrency(order.discountInCents)}</strong>
          </div>
          <div>
            <span>Total pago</span>
            <strong>{formatCurrency(order.totalInCents)}</strong>
          </div>
          <div>
            <span>Cupom</span>
            <strong>{order.couponCode || "-"}</strong>
          </div>
        </div>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Split Asaas</h2>
        </div>
        {order.splitSummary.entries.length === 0 ? (
          <div className="empty">Este pedido ainda não tem split retornado pelo Asaas.</div>
        ) : (
          <div className="tableScroll">
            <table className="table financeTable">
              <thead>
                <tr>
                  <th>Carteira</th>
                  <th>Status Asaas</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {order.splitSummary.entries.map((entry) => (
                  <tr key={`${entry.walletId}:${entry.status}:${entry.totalInCents}`}>
                    <td>{entry.walletLabel}</td>
                    <td>{entry.status}</td>
                    <td>{formatCurrency(entry.totalInCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">
          O status do split aqui é o último retorno salvo do Asaas. A liquidação final deve ser conferida no extrato do Asaas.
        </p>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Itens</h2>
        </div>
        <div className="tableScroll">
          <table className="table operationalTable">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Qtd.</th>
                <th>Unitário</th>
                <th>Taxa</th>
                <th>Subtotal</th>
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
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Ingressos emitidos</h2>
          <Link className="secondaryButton" href="/admin/check-in">
            Abrir check-in
          </Link>
        </div>
        {order.tickets.length === 0 ? (
          <div className="empty">Nenhum ingresso emitido ainda.</div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Lote</th>
                  <th>Status</th>
                  <th>Emitido em</th>
                  <th>Check-ins</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {order.tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <strong>{ticket.code}</strong>
                    </td>
                    <td>{ticket.lot.name}</td>
                    <td>{ticketStatusLabels[ticket.status]}</td>
                    <td>{formatDateTime(ticket.issuedAt)}</td>
                    <td>
                      {ticket.checkIns.length === 0 ? (
                        "-"
                      ) : (
                        ticket.checkIns.map((checkIn) => (
                          <div key={checkIn.id}>
                            {checkIn.status} em {formatDateTime(checkIn.checkedAt)}
                            {checkIn.adminUser ? (
                              <>
                                <br />
                                <span className="muted">{checkIn.adminUser.name}</span>
                              </>
                            ) : null}
                          </div>
                        ))
                      )}
                    </td>
                    <td>
                      <Link className="secondaryButton smallButton" href={`/ingresso/${ticket.code}`}>
                        Ver ingresso
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
