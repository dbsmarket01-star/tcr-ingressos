import { Resend } from "resend";

type TicketEmailInput = {
  to: string;
  buyerName: string;
  orderCode: string;
  eventTitle: string;
  eventDate: Date;
  venueName: string;
  tickets: Array<{
    code: string;
    lotName: string;
    url: string;
  }>;
};

type PasswordResetEmailInput = {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
};

type OrderPendingPaymentEmailInput = {
  to: string;
  buyerName: string;
  orderCode: string;
  eventTitle: string;
  eventDate: Date;
  venueName: string;
  totalInCents: number;
  expiresAt: Date | null;
  orderUrl: string;
};

type OrderExpiredEmailInput = {
  to: string;
  buyerName: string;
  orderCode: string;
  eventTitle: string;
  orderUrl: string;
};

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(value);
}

function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueInCents / 100);
}

function buildTicketEmailHtml(input: TicketEmailInput) {
  const ticketLinks = input.tickets
    .map(
      (ticket) => `
        <li style="margin: 14px 0; padding: 14px; border: 1px solid #dfe4ea; border-radius: 8px;">
          <strong>${ticket.lotName}</strong><br />
          Codigo: ${ticket.code}<br />
          <a href="${ticket.url}" style="color: #0e7c66; font-weight: 700;">Abrir ingresso</a>
        </li>
      `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.5;">
      <h1 style="margin: 0 0 12px;">Seus ingressos - TCR Ingressos</h1>
      <p>Olá, ${input.buyerName}.</p>
      <p>Seu pagamento foi aprovado e seus ingressos para <strong>${input.eventTitle}</strong> estão disponíveis.</p>
      <p>
        <strong>Data:</strong> ${formatDate(input.eventDate)}<br />
        <strong>Local:</strong> ${input.venueName}<br />
        <strong>Pedido:</strong> ${input.orderCode}
      </p>
      <h2>Ingressos</h2>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${ticketLinks}
      </ul>
      <p>Apresente o QR Code do ingresso na entrada do evento.</p>
    </div>
  `;
}

function buildTicketEmailText(input: TicketEmailInput) {
  const tickets = input.tickets
    .map((ticket) => `- ${ticket.lotName} | ${ticket.code} | ${ticket.url}`)
    .join("\n");

  return [
    `Olá, ${input.buyerName}.`,
    "",
    `Seu pagamento foi aprovado e seus ingressos para ${input.eventTitle} estão disponíveis.`,
    `Data: ${formatDate(input.eventDate)}`,
    `Local: ${input.venueName}`,
    `Pedido: ${input.orderCode}`,
    "",
    "Ingressos:",
    tickets,
    "",
    "Apresente o QR Code do ingresso na entrada do evento."
  ].join("\n");
}

export async function sendTicketsEmail(input: TicketEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "TCR Ingressos <ingressos@tcringressos.com.br>";

  if (!apiKey) {
    console.log("[email:dry-run] Ingressos gerados para envio", {
      to: input.to,
      orderCode: input.orderCode,
      tickets: input.tickets.map((ticket) => ticket.url)
    });
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: input.to,
    subject: `Seus ingressos - ${input.eventTitle}`,
    html: buildTicketEmailHtml(input),
    text: buildTicketEmailText(input)
  });
}

export function createPublicTicketUrl(ticketCode: string) {
  return `${getAppUrl()}/ingresso/${ticketCode}`;
}

export function createPublicOrderUrl(orderCode: string) {
  return `${getAppUrl()}/pedido/${orderCode}`;
}

function buildPasswordResetHtml(input: PasswordResetEmailInput) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.5;">
      <h1 style="margin: 0 0 12px;">Redefinir senha - TCR Ingressos</h1>
      <p>Olá, ${input.name}.</p>
      <p>Recebemos uma solicitacao para redefinir a senha do seu acesso interno.</p>
      <p>
        <a href="${input.resetUrl}" style="background: #0e7c66; border-radius: 8px; color: white; display: inline-block; font-weight: 700; padding: 12px 18px; text-decoration: none;">
          Redefinir senha
        </a>
      </p>
      <p>Este link expira em ${input.expiresInMinutes} minutos. Se voce nao solicitou essa alteracao, ignore este e-mail.</p>
    </div>
  `;
}

function buildPasswordResetText(input: PasswordResetEmailInput) {
  return [
    `Olá, ${input.name}.`,
    "",
    "Recebemos uma solicitacao para redefinir a senha do seu acesso interno na TCR Ingressos.",
    `Acesse: ${input.resetUrl}`,
    "",
    `Este link expira em ${input.expiresInMinutes} minutos.`,
    "Se voce nao solicitou essa alteracao, ignore este e-mail."
  ].join("\n");
}

export async function sendAdminPasswordResetEmail(input: PasswordResetEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "TCR Ingressos <ingressos@tcringressos.com.br>";

  if (!apiKey) {
    console.log("[email:dry-run] Recuperacao de senha administrativa", {
      to: input.to,
      resetUrl: input.resetUrl
    });
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: input.to,
    subject: "Redefinir senha - TCR Ingressos",
    html: buildPasswordResetHtml(input),
    text: buildPasswordResetText(input)
  });
}

export function createAdminPasswordResetUrl(token: string) {
  return `${getAppUrl()}/login/reset/${token}`;
}

function buildOrderPendingPaymentHtml(input: OrderPendingPaymentEmailInput) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.5;">
      <h1 style="margin: 0 0 12px;">Pedido recebido - TCR Ingressos</h1>
      <p>Olá, ${input.buyerName}.</p>
      <p>Recebemos seu pedido para <strong>${input.eventTitle}</strong>. Para garantir seus ingressos, finalize o pagamento pelo link abaixo.</p>
      <p>
        <strong>Data:</strong> ${formatDate(input.eventDate)}<br />
        <strong>Local:</strong> ${input.venueName}<br />
        <strong>Pedido:</strong> ${input.orderCode}<br />
        <strong>Total:</strong> ${formatCurrency(input.totalInCents)}
      </p>
      ${
        input.expiresAt
          ? `<p><strong>Reserva valida ate:</strong> ${formatDate(input.expiresAt)}</p>`
          : ""
      }
      <p>
        <a href="${input.orderUrl}" style="background: #0e7c66; border-radius: 8px; color: white; display: inline-block; font-weight: 700; padding: 12px 18px; text-decoration: none;">
          Finalizar pagamento
        </a>
      </p>
      <p>Depois da aprovacao, seus ingressos com QR Code serao enviados automaticamente.</p>
    </div>
  `;
}

function buildOrderPendingPaymentText(input: OrderPendingPaymentEmailInput) {
  return [
    `Olá, ${input.buyerName}.`,
    "",
    `Recebemos seu pedido para ${input.eventTitle}.`,
    `Data: ${formatDate(input.eventDate)}`,
    `Local: ${input.venueName}`,
    `Pedido: ${input.orderCode}`,
    `Total: ${formatCurrency(input.totalInCents)}`,
    input.expiresAt ? `Reserva valida ate: ${formatDate(input.expiresAt)}` : "",
    "",
    `Finalize o pagamento: ${input.orderUrl}`,
    "",
    "Depois da aprovacao, seus ingressos com QR Code serao enviados automaticamente."
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendOrderPendingPaymentEmail(input: OrderPendingPaymentEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "TCR Ingressos <ingressos@tcringressos.com.br>";

  if (!apiKey) {
    console.log("[email:dry-run] Pedido pendente para envio", {
      to: input.to,
      orderCode: input.orderCode,
      orderUrl: input.orderUrl
    });
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: input.to,
    subject: `Pedido recebido - ${input.eventTitle}`,
    html: buildOrderPendingPaymentHtml(input),
    text: buildOrderPendingPaymentText(input)
  });
}

function buildOrderExpiredHtml(input: OrderExpiredEmailInput) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.5;">
      <h1 style="margin: 0 0 12px;">Pedido expirado - TCR Ingressos</h1>
      <p>Olá, ${input.buyerName}.</p>
      <p>O pedido <strong>${input.orderCode}</strong> para <strong>${input.eventTitle}</strong> expirou porque o pagamento nao foi concluido dentro do prazo.</p>
      <p>Nenhuma cobranca aprovada foi registrada para esse pedido.</p>
      <p>
        <a href="${input.orderUrl}" style="background: #0e7c66; border-radius: 8px; color: white; display: inline-block; font-weight: 700; padding: 12px 18px; text-decoration: none;">
          Ver pedido
        </a>
      </p>
    </div>
  `;
}

function buildOrderExpiredText(input: OrderExpiredEmailInput) {
  return [
    `Olá, ${input.buyerName}.`,
    "",
    `O pedido ${input.orderCode} para ${input.eventTitle} expirou porque o pagamento nao foi concluido dentro do prazo.`,
    "Nenhuma cobranca aprovada foi registrada para esse pedido.",
    "",
    `Ver pedido: ${input.orderUrl}`
  ].join("\n");
}

export async function sendOrderExpiredEmail(input: OrderExpiredEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "TCR Ingressos <ingressos@tcringressos.com.br>";

  if (!apiKey) {
    console.log("[email:dry-run] Pedido expirado para envio", {
      to: input.to,
      orderCode: input.orderCode,
      orderUrl: input.orderUrl
    });
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: input.to,
    subject: `Pedido expirado - ${input.eventTitle}`,
    html: buildOrderExpiredHtml(input),
    text: buildOrderExpiredText(input)
  });
}
