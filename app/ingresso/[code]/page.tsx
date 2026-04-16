import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/forms/CopyButton";
import { PrintButton } from "@/components/forms/PrintButton";
import { createTicketQrCodeSvg } from "@/features/tickets/ticket-qrcode";
import { getTicketByCode } from "@/features/tickets/ticket.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

type TicketPageProps = {
  params: Promise<{
    code: string;
  }>;
};

const ticketStatusLabels = {
  ACTIVE: "Ativo",
  USED: "Utilizado",
  CANCELED: "Cancelado",
  INVALID: "Invalido"
};

const ticketStatusClasses = {
  ACTIVE: "published",
  USED: "paid",
  CANCELED: "canceled",
  INVALID: "canceled"
};

const ticketStatusMessages = {
  ACTIVE: "Ingresso valido. Apresente o QR Code na entrada do evento.",
  USED: "Este ingresso ja foi utilizado. A reutilizacao sera bloqueada na portaria.",
  CANCELED: "Este ingresso esta cancelado e nao deve liberar entrada.",
  INVALID: "Este ingresso esta invalido e nao deve liberar entrada."
};

export default async function TicketPage({ params }: TicketPageProps) {
  const { code } = await params;
  const ticket = await getTicketByCode(code);

  if (!ticket) {
    notFound();
  }

  const qrCodeSvg = await createTicketQrCodeSvg(ticket.qrCodeToken);
  const lastCheckIn = ticket.checkIns[0];
  const canEnter = ticket.status === "ACTIVE";

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brandMark">T</span>
          <span>TCR Ingressos</span>
        </Link>
        <nav className="nav" aria-label="Navegacao">
          <Link href={`/pedido/${ticket.order.code}`}>Pedido</Link>
        </nav>
      </header>

      <section className="container ticketPageGrid">
        <article className="card ticketDocument">
          <div className="ticketHero">
            <div className="ticketHeroStatus">
              <span className={`status ${ticketStatusClasses[ticket.status]}`}>
                {ticketStatusLabels[ticket.status]}
              </span>
              <strong>{canEnter ? "Entrada liberada" : "Entrada bloqueada"}</strong>
            </div>
            <h1>{ticket.event.title}</h1>
            <p>
              {formatDateTime(ticket.event.startsAt)} - {ticket.event.venueName}
            </p>
          </div>

          <div className={`ticketQrStage ${canEnter ? "ticketValidStage" : "ticketBlockedStage"}`}>
            <div
              aria-label="QR Code do ingresso"
              className="ticketQrCode"
              dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
            />
            <strong>{ticket.code}</strong>
            <span>{ticketStatusMessages[ticket.status]}</span>
          </div>

          <div className="ticketInstructionGrid">
            <div>
              <span>1</span>
              <strong>Abra este ingresso</strong>
              <p>Mantenha o brilho da tela alto para facilitar a leitura.</p>
            </div>
            <div>
              <span>2</span>
              <strong>Apresente o QR Code</strong>
              <p>A equipe da portaria fara a leitura uma unica vez.</p>
            </div>
            <div>
              <span>3</span>
              <strong>Documento em maos</strong>
              <p>Se solicitado, confirme nome do pedido ou documento.</p>
            </div>
          </div>

          <div className="ticketDetailsGrid">
            <div>
              <span>Ingresso</span>
              <strong>{ticket.lot.name}</strong>
            </div>
            <div>
              <span>Comprador</span>
              <strong>{ticket.order.customer.name}</strong>
            </div>
            <div>
              <span>Pedido</span>
              <strong>{ticket.order.code}</strong>
            </div>
            <div>
              <span>Emitido em</span>
              <strong>{formatDateTime(ticket.issuedAt)}</strong>
            </div>
            <div>
              <span>Local</span>
              <strong>{ticket.event.venueName}</strong>
            </div>
            <div className="wideDetail">
              <span>Endereco</span>
              <strong>{ticket.event.venueAddress}</strong>
            </div>
          </div>
        </article>

        <aside className="card">
          <h2>Validacao</h2>
          <p className="muted">
            Apresente este QR Code na entrada. Cada ingresso pode ser validado uma unica vez.
          </p>
          <div className={`ticketStatusCallout ${canEnter ? "isReady" : "isBlocked"}`}>
            <span>Status do ingresso</span>
            <strong>{ticketStatusLabels[ticket.status]}</strong>
            <p>{ticketStatusMessages[ticket.status]}</p>
          </div>
          <div className="paymentBox">
            <h3>Token do QR</h3>
            <p className="muted breakText">{ticket.qrCodeToken}</p>
          </div>
          {lastCheckIn ? (
            <div className="paymentBox">
              <h3>Ultima validacao</h3>
              <p className="muted">
                {lastCheckIn.status} em {formatDateTime(lastCheckIn.checkedAt)}
              </p>
            </div>
          ) : null}
          <Link className="button fullButton" href={`/pedido/${ticket.order.code}`}>
            Voltar ao pedido
          </Link>
          <PrintButton className="secondaryButton fullButton" label="Imprimir ingresso" />
          <CopyButton
            className="secondaryButton fullButton"
            copiedLabel="Codigo copiado"
            label="Copiar codigo do ingresso"
            value={ticket.code}
          />
          <CopyButton
            className="secondaryButton fullButton"
            copiedLabel="Token copiado"
            label="Copiar token do QR"
            value={ticket.qrCodeToken}
          />
        </aside>
      </section>
    </main>
  );
}
