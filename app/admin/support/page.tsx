import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { CopyButton } from "@/components/forms/CopyButton";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
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

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "CL";
}

function toWhatsappHref(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const admin = await requirePermission("SUPPORT");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const orders = query ? await searchSupportOrders(query, admin.organizationId, getAdminAllowedEventIds(admin)) : [];

  return (
    <AdminShell
      title="Atendimento"
      description="Localize pedidos e reenvie ingressos rapidamente."
    >
      <div className="supportDeskPage">
        <section className="supportDeskSearchCard" aria-label="Busca de atendimento">
          <form className="supportDeskSearchForm">
            <label>
              <span>Buscar pedido, cliente ou ingresso</span>
              <input
                name="q"
                placeholder="Ex: Nome, e-mail, telefone, CPF ou código do ingresso"
                defaultValue={query}
              />
            </label>
            <button className="supportDeskSearchButton" type="submit">
              Buscar
            </button>
          </form>
          <div className="supportDeskChips" aria-label="Tipos de busca">
            <span>Pedido</span>
            <span>E-mail</span>
            <span>Telefone</span>
            <span>CPF</span>
            <span>Código do ingresso</span>
          </div>

          {params.sent ? (
            <div className="successBox supportDeskFeedback">
              Ingressos do pedido {params.order} reenviados para {params.sent}.
            </div>
          ) : null}
          {params.paymentSent ? (
            <div className="successBox supportDeskFeedback">
              Link de pagamento do pedido {params.order} reenviado para {params.paymentSent}.
            </div>
          ) : null}
          {params.error ? <div className="errorBox supportDeskFeedback">{params.error}</div> : null}
        </section>

        <section className="supportDeskResults" aria-label="Resultados de atendimento">
          {orders.length === 0 ? (
            <article className="supportDeskEmpty">
              <strong>{query ? "Nenhum pedido encontrado." : "Comece pela busca."}</strong>
              <span>
                {query
                  ? "Confira nome, e-mail, telefone, CPF, código do pedido ou código do ingresso."
                  : "Use a busca acima para localizar rapidamente pedidos, clientes e ingressos."}
              </span>
            </article>
          ) : (
            orders.map((order) => {
              const whatsappHref = toWhatsappHref(order.customer.phone);

              return (
                <article className="supportDeskOrderCard" key={order.id}>
                  <div className="supportDeskFoundHeader">
                    <div className="supportDeskFoundIcon" aria-hidden="true">✓</div>
                    <div>
                      <h2>Pedido encontrado</h2>
                      <p>Confira os dados do cliente e gerencie o ingresso.</p>
                    </div>
                    <Link className="supportDeskNewButton" href="/admin/support">
                      Novo atendimento
                    </Link>
                  </div>

                  <div className="supportDeskCustomerPanel">
                    <div className="supportDeskCustomerIntro">
                      <span className="supportDeskAvatar">{getInitials(order.customer.name)}</span>
                      <div>
                        <strong>{order.customer.name}</strong>
                        <span>{order.customer.email}</span>
                        <span>{order.customer.phone || "Telefone não informado"}</span>
                      </div>
                    </div>

                    <div className="supportDeskInfo">
                      <span>Pedido</span>
                      <strong>{order.code}</strong>
                    </div>
                    <div className="supportDeskInfo">
                      <span>Evento</span>
                      <strong>{order.event.title}</strong>
                    </div>
                    <div className="supportDeskInfo">
                      <span>Data do pedido</span>
                      <strong>{formatDateTime(order.createdAt)}</strong>
                    </div>
                    <div className="supportDeskInfo">
                      <span>Status</span>
                      <strong className={`supportDeskStatus supportDeskStatus${order.status}`}>
                        {orderStatusLabels[order.status]}
                      </strong>
                    </div>
                    <div className="supportDeskInfo supportDeskTotal">
                      <span>Total</span>
                      <strong>{formatCurrency(order.totalInCents)}</strong>
                    </div>
                  </div>

                  <div className="supportDeskTicketPanel">
                    {order.items.map((item) => (
                      <div className="supportDeskTicketRow" key={item.id}>
                        <div className="supportDeskTicketIcon" aria-hidden="true" />
                        <div className="supportDeskTicketName">
                          <strong>{item.quantity}x {item.lot.name}</strong>
                          <span>{item.lot.description || "Setor geral"}</span>
                        </div>
                        <div>
                          <span>Valor unitário</span>
                          <strong>{formatCurrency(item.unitPriceInCents)}</strong>
                        </div>
                        <div>
                          <span>Total do ingresso</span>
                          <strong>{formatCurrency(item.totalInCents)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="supportDeskQuickActions">
                    <h3>Ações rápidas</h3>
                    <div className="supportDeskActionGrid">
                      {whatsappHref ? (
                        <a
                          className="supportQuickAction supportWhatsappAction"
                          href={whatsappHref}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Enviar mensagem no WhatsApp
                        </a>
                      ) : (
                        <span className="supportQuickAction supportWhatsappAction isDisabled">
                          WhatsApp não informado
                        </span>
                      )}
                      <form action={resendTicketsEmailAction}>
                        <input type="hidden" name="orderCode" value={order.code} />
                        <input type="hidden" name="query" value={query} />
                        <button className="supportQuickAction supportEmailSendAction" type="submit" disabled={order.tickets.length === 0}>
                          Reenviar ingresso por e-mail
                        </button>
                      </form>
                      <CopyButton
                        className="supportQuickAction supportCopyEmailAction"
                        label="Copiar e-mail"
                        copiedLabel="E-mail copiado"
                        value={order.customer.email}
                      />
                      {order.customer.phone ? (
                        <CopyButton
                          className="supportQuickAction supportCopyPhoneAction"
                          label="Copiar telefone"
                          copiedLabel="Telefone copiado"
                          value={order.customer.phone}
                        />
                      ) : (
                        <span className="supportQuickAction supportCopyPhoneAction isDisabled">
                          Telefone não informado
                        </span>
                      )}
                    </div>
                    {order.status === "PENDING_PAYMENT" ? (
                      <form action={resendPendingPaymentEmailAction} className="supportDeskPaymentRecovery">
                        <input type="hidden" name="orderCode" value={order.code} />
                        <input type="hidden" name="query" value={query} />
                        <button className="supportDeskTextButton" type="submit">
                          Reenviar link de pagamento
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </section>

        <aside className="supportDeskHint">
          <strong>Dica rápida</strong>
          <span>Use a busca acima para encontrar pedidos por nome, e-mail, telefone, CPF ou código do ingresso.</span>
        </aside>
      </div>
    </AdminShell>
  );
}
