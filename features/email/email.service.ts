import { Resend } from "resend";
import { getAdminBaseUrl, getPublicBaseUrl } from "@/lib/public-url";
import { formatLongDateTime } from "@/lib/format";

type EmailOrganization = {
  name?: string | null;
  publicDomain?: string | null;
  adminDomain?: string | null;
};

type TicketEmailInput = {
  to: string;
  buyerName: string;
  orderCode: string;
  brandName?: string;
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
  brandName?: string;
  resetUrl: string;
  expiresInMinutes: number;
};

type OrderPendingPaymentEmailInput = {
  to: string;
  buyerName: string;
  orderCode: string;
  brandName?: string;
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
  brandName?: string;
  eventTitle: string;
  orderUrl: string;
};

type UnlockApprovalEmailInput = {
  to: string;
  userName: string;
  partnerEmail: string;
  actionLabel: string;
  approvalCode: string;
  expiresAt: Date;
  approvalUrl?: string;
  reason?: string | null;
};

type LeadCaptureConfirmationEmailInput = {
  to: string;
  name: string;
  eventTitle: string;
  whatsappGroupUrl?: string | null;
  brandName?: string;
  supportEmail?: string | null;
};

type LeadBroadcastEmailInput = {
  to: string;
  name: string;
  subject: string;
  body: string;
  imageUrl?: string | null;
  brandName?: string;
  eventTitle: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  supportEmail?: string | null;
};

function formatDate(value: Date) {
  return formatLongDateTime(value);
}

function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueInCents / 100);
}

function buildTicketEmailHtml(input: TicketEmailInput) {
  const brandName = input.brandName || "TCR Ingressos";
  const ticketLinks = input.tickets
    .map(
      (ticket) => `
        <li style="margin: 14px 0; padding: 14px; border: 1px solid #dfe4ea; border-radius: 8px;">
          <strong>${ticket.lotName}</strong><br />
          Código: ${ticket.code}<br />
          <a href="${ticket.url}" style="color: #0e7c66; font-weight: 700;">Abrir ingresso</a>
        </li>
      `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.5;">
      <h1 style="margin: 0 0 12px;">Seus ingressos - ${brandName}</h1>
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
  const brandName = input.brandName || "TCR Ingressos";
  const tickets = input.tickets
    .map((ticket) => `- ${ticket.lotName} | ${ticket.code} | ${ticket.url}`)
    .join("\n");

  return [
    `Olá, ${input.buyerName}.`,
    "",
    `Seu pagamento foi aprovado e seus ingressos para ${input.eventTitle} estão disponíveis.`,
    `Operação: ${brandName}`,
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
  const from = process.env.EMAIL_FROM || `${input.brandName || "TCR Ingressos"} <ingressos@tcringressos.com.br>`;

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

export function createPublicTicketUrl(ticketCode: string, organization?: EmailOrganization | null) {
  return `${getPublicBaseUrl(organization)}/ingresso/${ticketCode}`;
}

export function createPublicOrderUrl(orderCode: string, organization?: EmailOrganization | null) {
  return `${getPublicBaseUrl(organization)}/pedido/${orderCode}`;
}

function buildPasswordResetHtml(input: PasswordResetEmailInput) {
  const brandName = input.brandName || "TCR Ingressos";
  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.5;">
      <h1 style="margin: 0 0 12px;">Redefinir senha - ${brandName}</h1>
      <p>Olá, ${input.name}.</p>
      <p>Recebemos uma solicitação para redefinir a senha do seu acesso interno.</p>
      <p>
        <a href="${input.resetUrl}" style="background: #0e7c66; border-radius: 8px; color: white; display: inline-block; font-weight: 700; padding: 12px 18px; text-decoration: none;">
          Redefinir senha
        </a>
      </p>
      <p>Este link expira em ${input.expiresInMinutes} minutos. Se você não solicitou essa alteração, ignore este e-mail.</p>
    </div>
  `;
}

function buildPasswordResetText(input: PasswordResetEmailInput) {
  const brandName = input.brandName || "TCR Ingressos";
  return [
    `Olá, ${input.name}.`,
    "",
    `Recebemos uma solicitação para redefinir a senha do seu acesso interno na ${brandName}.`,
    `Acesse: ${input.resetUrl}`,
    "",
    `Este link expira em ${input.expiresInMinutes} minutos.`,
    "Se você não solicitou essa alteração, ignore este e-mail."
  ].join("\n");
}

export async function sendAdminPasswordResetEmail(input: PasswordResetEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || `${input.brandName || "TCR Ingressos"} <ingressos@tcringressos.com.br>`;

  if (!apiKey) {
      console.log("[email:dry-run] Recuperação de senha administrativa", {
      to: input.to,
      resetUrl: input.resetUrl
    });
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: input.to,
    subject: `Redefinir senha - ${input.brandName || "TCR Ingressos"}`,
    html: buildPasswordResetHtml(input),
    text: buildPasswordResetText(input)
  });
}

export function createAdminPasswordResetUrl(token: string, organization?: EmailOrganization | null) {
  return `${getAdminBaseUrl(organization)}/login/reset/${token}`;
}

function buildOrderPendingPaymentHtml(input: OrderPendingPaymentEmailInput) {
  const brandName = input.brandName || "TCR Ingressos";
  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.5;">
      <h1 style="margin: 0 0 12px;">Pedido recebido - ${brandName}</h1>
      <p>Olá, ${input.buyerName}.</p>
      <p>Recebemos seu pedido para <strong>${input.eventTitle}</strong>. Para garantir seus ingressos, finalize o pagamento pelo link abaixo.</p>
      <p>
        <strong>Data:</strong> ${formatDate(input.eventDate)}<br />
        <strong>Local:</strong> ${input.venueName}<br />
        <strong>Pedido:</strong> ${input.orderCode}<br />
        <strong>Total:</strong> ${formatCurrency(input.totalInCents)}
      </p>
      <p>
        <a href="${input.orderUrl}" style="background: #0e7c66; border-radius: 8px; color: white; display: inline-block; font-weight: 700; padding: 12px 18px; text-decoration: none;">
          Finalizar pagamento
        </a>
      </p>
      <p>Depois da aprovação, seus ingressos com QR Code serão enviados automaticamente.</p>
    </div>
  `;
}

function buildOrderPendingPaymentText(input: OrderPendingPaymentEmailInput) {
  const brandName = input.brandName || "TCR Ingressos";
  return [
    `Olá, ${input.buyerName}.`,
    "",
    `Recebemos seu pedido para ${input.eventTitle}.`,
    `Operação: ${brandName}`,
    `Data: ${formatDate(input.eventDate)}`,
    `Local: ${input.venueName}`,
    `Pedido: ${input.orderCode}`,
    `Total: ${formatCurrency(input.totalInCents)}`,
    "",
    `Finalize o pagamento: ${input.orderUrl}`,
    "",
    "Depois da aprovação, seus ingressos com QR Code serão enviados automaticamente."
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendOrderPendingPaymentEmail(input: OrderPendingPaymentEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || `${input.brandName || "TCR Ingressos"} <ingressos@tcringressos.com.br>`;

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
  const brandName = input.brandName || "TCR Ingressos";
  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.5;">
      <h1 style="margin: 0 0 12px;">Pedido expirado - ${brandName}</h1>
      <p>Olá, ${input.buyerName}.</p>
      <p>O pedido <strong>${input.orderCode}</strong> para <strong>${input.eventTitle}</strong> expirou porque o pagamento não foi concluído dentro do prazo.</p>
      <p>Nenhuma cobrança aprovada foi registrada para esse pedido.</p>
      <p>
        <a href="${input.orderUrl}" style="background: #0e7c66; border-radius: 8px; color: white; display: inline-block; font-weight: 700; padding: 12px 18px; text-decoration: none;">
          Ver pedido
        </a>
      </p>
    </div>
  `;
}

function buildOrderExpiredText(input: OrderExpiredEmailInput) {
  const brandName = input.brandName || "TCR Ingressos";
  return [
    `Olá, ${input.buyerName}.`,
    "",
    `Operação: ${brandName}`,
    `O pedido ${input.orderCode} para ${input.eventTitle} expirou porque o pagamento não foi concluído dentro do prazo.`,
    "Nenhuma cobrança aprovada foi registrada para esse pedido.",
    "",
    `Ver pedido: ${input.orderUrl}`
  ].join("\n");
}

export async function sendOrderExpiredEmail(input: OrderExpiredEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || `${input.brandName || "TCR Ingressos"} <ingressos@tcringressos.com.br>`;

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

function buildUnlockApprovalHtml(input: UnlockApprovalEmailInput) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.5;">
      <h1 style="margin: 0 0 12px;">Aprovação de desbloqueio - Guerra à Pornografia</h1>
      <p>Olá.</p>
      <p>${input.userName} solicitou autorização para <strong>${input.actionLabel}</strong>.</p>
      ${input.reason ? `<p><strong>Motivo informado:</strong> ${input.reason}</p>` : ""}
      <p>
        <strong>Código de aprovação:</strong><br />
        <span style="display:inline-block; font-size: 28px; font-weight: 800; letter-spacing: 4px; padding: 10px 14px; background: #f2f6f8; border-radius: 10px;">${input.approvalCode}</span>
      </p>
      <p>Esse código expira em ${formatDate(input.expiresAt)}.</p>
      ${input.approvalUrl ? `<p><a href="${input.approvalUrl}" style="background: #0b7a63; border-radius: 8px; color: white; display: inline-block; font-weight: 700; padding: 12px 18px; text-decoration: none;">Abrir página de aprovação</a></p>` : ""}
      <p>Se você não aprovar essa ação, ignore este e-mail.</p>
    </div>
  `;
}

function buildUnlockApprovalText(input: UnlockApprovalEmailInput) {
  return [
    "Aprovação de desbloqueio - Guerra à Pornografia",
    "",
    `${input.userName} solicitou autorização para ${input.actionLabel}.`,
    input.reason ? `Motivo informado: ${input.reason}` : null,
    "",
    `Código de aprovação: ${input.approvalCode}`,
    `Expira em: ${formatDate(input.expiresAt)}`,
    input.approvalUrl ? `Página de aprovação: ${input.approvalUrl}` : null,
    "",
    "Se você não aprovar essa ação, ignore este e-mail."
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendUnlockApprovalEmail(input: UnlockApprovalEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Guerra à Pornografia <suporte@guerraapornografia.com.br>";

  if (!apiKey) {
    console.log("[email:dry-run] Aprovacao de desbloqueio", {
      to: input.to,
      actionLabel: input.actionLabel,
      approvalCode: input.approvalCode,
      expiresAt: input.expiresAt.toISOString()
    });
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: input.to,
    subject: "Código de aprovação - Guerra à Pornografia",
    html: buildUnlockApprovalHtml(input),
    text: buildUnlockApprovalText(input)
  });
}

function buildLeadCaptureConfirmationHtml(input: LeadCaptureConfirmationEmailInput) {
  const brandName = input.brandName || "TCR Ingressos";
  const whatsappButton = input.whatsappGroupUrl
    ? `
      <p>
        <a href="${input.whatsappGroupUrl}" style="background: #14b866; border-radius: 10px; color: white; display: inline-block; font-weight: 700; padding: 14px 20px; text-decoration: none;">
          Entrar no grupo do WhatsApp
        </a>
      </p>
    `
    : "";

  const supportLine = input.supportEmail
    ? `<p>Se precisar de ajuda, responda este e-mail ou fale com a equipe em <strong>${input.supportEmail}</strong>.</p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.6;">
      <h1 style="margin: 0 0 12px;">Cadastro recebido - ${brandName}</h1>
      <p>Olá, ${input.name}.</p>
      <p>Seu cadastro para <strong>${input.eventTitle}</strong> foi realizado com sucesso.</p>
      <p><strong>Último passo:</strong> entre no grupo oficial do WhatsApp para garantir o acesso às condições especiais e receber o desconto de até 30% na abertura.</p>
      ${whatsappButton}
      <p>É no grupo que vamos liberar o aviso de abertura, o link certo e as próximas informações do evento.</p>
      ${supportLine}
    </div>
  `;
}

function buildLeadCaptureConfirmationText(input: LeadCaptureConfirmationEmailInput) {
  return [
    `Olá, ${input.name}.`,
    "",
    `Seu cadastro para ${input.eventTitle} foi realizado com sucesso.`,
    "Último passo: entre no grupo oficial do WhatsApp para garantir o acesso às condições especiais e receber o desconto de até 30% na abertura.",
    input.whatsappGroupUrl ? `Entrar no grupo: ${input.whatsappGroupUrl}` : null,
    "",
    "É no grupo que vamos liberar o aviso de abertura, o link certo e as próximas informações do evento.",
    input.supportEmail ? `Suporte: ${input.supportEmail}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendLeadCaptureConfirmationEmail(input: LeadCaptureConfirmationEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || `${input.brandName || "TCR Ingressos"} <ingressos@tcringressos.com.br>`;

  if (!apiKey) {
    console.log("[email:dry-run] Confirmacao de lead", {
      to: input.to,
      eventTitle: input.eventTitle,
      whatsappGroupUrl: input.whatsappGroupUrl
    });
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: input.to,
    subject: `Entre no grupo para garantir seu desconto - ${input.eventTitle}`,
    html: buildLeadCaptureConfirmationHtml(input),
    text: buildLeadCaptureConfirmationText(input)
  });
}

function renderBroadcastBodyAsHtml(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin: 0 0 14px;">${line}</p>`)
    .join("");
}

function buildLeadBroadcastHtml(input: LeadBroadcastEmailInput) {
  const brandName = input.brandName || "TCR Ingressos";
  const imageBlock = input.imageUrl
    ? `<p style="margin: 0 0 18px;"><img src="${input.imageUrl}" alt="${input.eventTitle}" style="max-width: 100%; border-radius: 14px; display: block;" /></p>`
    : "";
  const ctaButton = input.ctaUrl
    ? `
      <p style="margin: 20px 0 0;">
        <a href="${input.ctaUrl}" style="background: #14b866; border-radius: 10px; color: white; display: inline-block; font-weight: 700; padding: 14px 20px; text-decoration: none;">
          ${input.ctaLabel || "Abrir link"}
        </a>
      </p>
    `
    : "";
  const supportLine = input.supportEmail
    ? `<p style="margin: 20px 0 0; color: #607089;">Suporte: ${input.supportEmail}</p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.6;">
      <p style="margin: 0 0 8px; color: #607089;">${brandName}</p>
      <h1 style="margin: 0 0 16px;">${input.subject}</h1>
      <p style="margin: 0 0 16px;">Olá, ${input.name}.</p>
      ${imageBlock}
      ${renderBroadcastBodyAsHtml(input.body)}
      ${ctaButton}
      ${supportLine}
    </div>
  `;
}

function buildLeadBroadcastText(input: LeadBroadcastEmailInput) {
  return [
    `Olá, ${input.name}.`,
    "",
    input.subject,
    "",
    input.body,
    input.ctaUrl ? `${input.ctaLabel || "Abrir link"}: ${input.ctaUrl}` : null,
    input.supportEmail ? `Suporte: ${input.supportEmail}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendLeadBroadcastEmail(input: LeadBroadcastEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || `${input.brandName || "TCR Ingressos"} <ingressos@tcringressos.com.br>`;

  if (!apiKey) {
    console.log("[email:dry-run] Disparo de leads", {
      to: input.to,
      subject: input.subject,
      imageUrl: input.imageUrl,
      ctaUrl: input.ctaUrl
    });
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: buildLeadBroadcastHtml(input),
    text: buildLeadBroadcastText(input)
  });
}
