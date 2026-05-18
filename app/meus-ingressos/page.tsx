import Link from "next/link";
import { redirect } from "next/navigation";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import type { Metadata } from "next";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getOrderByCode } from "@/features/orders/order.service";
import { getTicketByCode } from "@/features/tickets/ticket.service";
import { findPublicOrdersByCustomerEmail } from "@/features/support/support.service";
import { resendPublicAccessByEmailAction } from "@/features/support/public-ticket-lookup.actions";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Encontrar meus ingressos",
  robots: {
    index: false,
    follow: false
  }
};

type TicketLookupPageProps = {
  searchParams?: Promise<{
    code?: string;
    email?: string;
    sent?: string;
    success?: string;
    error?: string;
  }>;
};

function normalizeLookupCode(raw?: string) {
  if (!raw) {
    return "";
  }

  return raw.trim().toUpperCase();
}

type EmailLookupOrder = Awaited<ReturnType<typeof findPublicOrdersByCustomerEmail>>[number];

function groupOrdersByEvent(orders: EmailLookupOrder[]) {
  const groups = new Map<
    string,
    {
      event: EmailLookupOrder["event"];
      orders: EmailLookupOrder[];
      orderCount: number;
      ticketCount: number;
      totalInCents: number;
    }
  >();

  for (const order of orders) {
    const current = groups.get(order.event.id);

    if (current) {
      current.orders.push(order);
      current.orderCount += 1;
      current.ticketCount += order.tickets.length;
      current.totalInCents += order.totalInCents;
      continue;
    }

    groups.set(order.event.id, {
      event: order.event,
      orders: [order],
      orderCount: 1,
      ticketCount: order.tickets.length,
      totalInCents: order.totalInCents
    });
  }

  return Array.from(groups.values()).sort(
    (first, second) => new Date(first.event.startsAt).getTime() - new Date(second.event.startsAt).getTime()
  );
}

export default async function TicketLookupPage({ searchParams }: TicketLookupPageProps) {
  const query = searchParams ? await searchParams : {};
  const organizationContext = await getCurrentOrganizationContext();
  const lookupCode = normalizeLookupCode(query.code);
  const lookupEmail = String(query.email ?? "").trim().toLowerCase();

  if (lookupCode) {
    const [order, ticket] = await Promise.all([
      getOrderByCode(lookupCode, organizationContext.organization.id),
      getTicketByCode(lookupCode, organizationContext.organization.id)
    ]);

    if (order) {
      redirect(`/pedido/${order.code}`);
    }

    if (ticket) {
      redirect(`/ingresso/${ticket.code}`);
    }
  }

  const lookupError = lookupCode ? "Não encontramos um pedido ou ingresso com esse código." : null;
  const emailOrders = lookupEmail
    ? await findPublicOrdersByCustomerEmail(lookupEmail, organizationContext.organization.id)
    : [];
  const emailLookupError = !lookupError && query.error ? String(query.error) : null;
  const emailLookupSuccess = query.sent === "1" && query.success ? String(query.success) : null;
  const hasEmailMatches = lookupEmail && emailOrders.length > 0;
  const eventGroups = groupOrdersByEvent(emailOrders);

  return (
    <main className="shell ticketLookupPage">
      <header className="topbar">
        <Link className="brand" href="/">
          {organizationContext.brandLogoUrl ? (
            <img alt={organizationContext.brandName} className="brandLogo" src={organizationContext.brandLogoUrl} />
          ) : (
            <>
              <span className="brandMark">{organizationContext.brandMark}</span>
              <span>{organizationContext.brandName}</span>
            </>
          )}
        </Link>
        <nav className="nav" aria-label="Navegação">
          <Link href="/">Voltar para eventos</Link>
        </nav>
      </header>

      <section className="container ticketLookupContainer">
        <article className="ticketLookupCard">
          <span className="eyebrow">Área do cliente</span>
          <h1>Encontrar meus ingressos</h1>
          <p>
            Informe o e-mail usado na compra para ver os eventos futuros vinculados a ele. Depois escolha o evento e receba os ingressos no próprio e-mail.
          </p>

          <form className="ticketLookupForm" method="get">
            <label className="field">
              <span>E-mail do comprador</span>
              <input
                defaultValue={lookupEmail}
                name="email"
                placeholder="voce@exemplo.com"
                required
                type="email"
              />
            </label>

            <button className="button fullButton" type="submit">
              Ver meus eventos
            </button>
          </form>

          {emailLookupSuccess ? <div className="formFeedback success">{emailLookupSuccess}</div> : null}
          <ErrorNotice message={emailLookupError} className="formFeedback" />
          {lookupEmail && !hasEmailMatches && !emailLookupError && !emailLookupSuccess ? (
            <div className="formFeedback error">Não encontramos ingressos ativos em eventos futuros com esse e-mail nesta operação.</div>
          ) : null}

          {eventGroups.length > 0 ? (
            <div className="ticketLookupEventList">
              <div className="ticketLookupMatchBox">
                <strong>Encontramos {eventGroups.length} evento(s) futuro(s) com ingressos ativos.</strong>
                <span>Escolha abaixo qual evento você quer receber no e-mail cadastrado.</span>
              </div>

              <div className="ticketLookupEvents">
                {eventGroups.map((group) => {
                  const place = [group.event.venueName, `${group.event.city}, ${group.event.state}`]
                    .filter(Boolean)
                    .join(" • ");
                  const primaryOrder = group.orders[0];

                  return (
                    <article className="ticketLookupEventCard" key={group.event.id}>
                      <div>
                        <span className="ticketLookupEventBadge">
                          {group.ticketCount} ingresso{group.ticketCount === 1 ? "" : "s"}
                        </span>
                        <h2>{group.event.title}</h2>
                        <p>{place}</p>
                      </div>

                      <dl className="ticketLookupEventMeta">
                        <div>
                          <dt>Data</dt>
                          <dd>{formatDateTime(group.event.startsAt)}</dd>
                        </div>
                        <div>
                          <dt>Pedidos</dt>
                          <dd>{group.orderCount}</dd>
                        </div>
                        <div>
                          <dt>Total</dt>
                          <dd>{formatCurrency(group.totalInCents)}</dd>
                        </div>
                      </dl>

                      {group.orders.length === 1 && primaryOrder ? (
                        <Link className="button fullButton" href={`/pedido/${primaryOrder.code}`}>
                          Acessar meus ingressos
                        </Link>
                      ) : (
                        <div className="ticketLookupOrderLinks" aria-label={`Pedidos de ${group.event.title}`}>
                          {group.orders.map((order) => (
                            <Link className="button fullButton" href={`/pedido/${order.code}`} key={order.id}>
                              Acessar pedido {order.code}
                            </Link>
                          ))}
                        </div>
                      )}

                      <form action={resendPublicAccessByEmailAction}>
                        <input name="email" type="hidden" value={lookupEmail} />
                        <input name="eventId" type="hidden" value={group.event.id} />
                        <button className="secondaryButton fullButton" type="submit">
                          Reenviar por e-mail
                        </button>
                      </form>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="ticketLookupDivider">
            <span>ou use um código</span>
          </div>

          <form className="ticketLookupForm" method="get">
            <label className="field">
              <span>Código do pedido ou ingresso</span>
              <input
                defaultValue={lookupCode}
                name="code"
                placeholder="Ex.: ING-ABC123..."
                required
                type="text"
              />
            </label>

            <button className="button fullButton" type="submit">
              Buscar agora
            </button>
          </form>

          <ErrorNotice message={lookupError} className="formFeedback" />

          <div className="ticketLookupHints">
            <div>
              <strong>Busca por e-mail</strong>
              <span>Mostramos apenas eventos futuros com ingressos ativos comprados nesta operação.</span>
            </div>
            <div>
              <strong>Pedido</strong>
              <span>Use o código recebido no e-mail ou na tela de confirmação da compra.</span>
            </div>
            <div>
              <strong>Ingresso</strong>
              <span>Se você já abriu o ticket, também pode colar o código do próprio ingresso.</span>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
