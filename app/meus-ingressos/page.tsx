import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getOrderByCode } from "@/features/orders/order.service";
import { getTicketByCode } from "@/features/tickets/ticket.service";
import { findPublicOrdersByCustomerEmail } from "@/features/support/support.service";
import { resendPublicAccessByEmailAction } from "@/features/support/public-ticket-lookup.actions";

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
            Informe o e-mail usado na compra para reenviar seus ingressos com um clique. Se preferir, você também pode usar o código do pedido ou do ingresso.
          </p>

          <form action={resendPublicAccessByEmailAction} className="ticketLookupForm">
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
              Receber meus ingressos por e-mail
            </button>
          </form>

          {emailLookupSuccess ? <div className="formFeedback success">{emailLookupSuccess}</div> : null}
          {emailLookupError ? <div className="formFeedback error">{emailLookupError}</div> : null}

          {hasEmailMatches ? (
            <div className="ticketLookupMatchBox">
              <strong>Encontramos {emailOrders.length} compra(s) com esse e-mail.</strong>
              <span>
                {emailOrders
                  .slice(0, 3)
                  .map((order) => order.event.title)
                  .join(" • ")}
              </span>
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

          {lookupError ? <div className="formFeedback error">{lookupError}</div> : null}

          <div className="ticketLookupHints">
            <div>
              <strong>Busca por e-mail</strong>
              <span>O sistema verifica compras desta operação e reenvia seus ingressos ou links válidos para o mesmo e-mail.</span>
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
