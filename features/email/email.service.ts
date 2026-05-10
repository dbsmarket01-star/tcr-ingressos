import { Resend } from "resend";
import { getAdminBaseUrl, getPublicBaseUrl, getPublicOrderUrl, getPublicTicketUrl } from "@/lib/public-url";
import { formatLongDateTime } from "@/lib/format";
import { parseImageCrop } from "@/lib/image-crop";

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
  imageCrop?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  publicBaseUrl?: string | null;
  brandLogoUrl?: string | null;
  brandName?: string;
  eventTitle: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  openTrackingUrl?: string | null;
  unsubscribeUrl?: string | null;
  instagramUrl?: string | null;
  supportEmail?: string | null;
};

type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

function extractResendMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Falha ao enviar e-mail pelo Resend.";
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  if ("name" in error && typeof error.name === "string") {
    return error.name;
  }

  return "Falha ao enviar e-mail pelo Resend.";
}

async function sendWithResend(
  resend: Resend,
  payload: EmailPayload
) {
  const result = await resend.emails.send(payload);

  const error = (result as { error?: unknown } | null)?.error;

  if (error) {
    throw new Error(extractResendMessage(error));
  }

  return result;
}

async function sendBatchWithResend(
  resend: Resend,
  payloads: EmailPayload[]
) {
  const result = await resend.batch.send(payloads, {
    batchValidation: "permissive"
  });

  const error = (result as { error?: unknown } | null)?.error;

  if (error) {
    throw new Error(extractResendMessage(error));
  }

  return {
    data: result.data?.data ?? [],
    errors: result.data?.errors ?? []
  };
}

function formatDate(value: Date) {
  return formatLongDateTime(value);
}

function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueInCents / 100);
}

function getDefaultBrandName(brandName?: string | null) {
  return brandName?.trim() || process.env.DEFAULT_EMAIL_BRAND || "Ingresaas";
}

function getDefaultEmailFrom(brandName?: string | null) {
  const resolvedBrandName = getDefaultBrandName(brandName);
  const fallbackAddress = process.env.DEFAULT_EMAIL_FROM_ADDRESS || "ingressos@ingresaas.app.br";
  return `${resolvedBrandName} <${fallbackAddress}>`;
}

function buildTicketEmailHtml(input: TicketEmailInput) {
  const brandName = getDefaultBrandName(input.brandName);
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
  const brandName = getDefaultBrandName(input.brandName);
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
  const from = process.env.EMAIL_FROM || getDefaultEmailFrom(input.brandName);

  if (!apiKey) {
    console.log("[email:dry-run] Ingressos gerados para envio", {
      to: input.to,
      orderCode: input.orderCode,
      tickets: input.tickets.map((ticket) => ticket.url)
    });
    return;
  }

  const resend = new Resend(apiKey);

  await sendWithResend(resend, {
    from,
    to: input.to,
    subject: `Seus ingressos - ${input.eventTitle}`,
    html: buildTicketEmailHtml(input),
    text: buildTicketEmailText(input)
  });
}

export function createPublicTicketUrl(ticketCode: string, organization?: EmailOrganization | null) {
  return getPublicTicketUrl(ticketCode, organization);
}

export function createPublicOrderUrl(orderCode: string, organization?: EmailOrganization | null) {
  return getPublicOrderUrl(orderCode, organization);
}

function buildPasswordResetHtml(input: PasswordResetEmailInput) {
  const brandName = getDefaultBrandName(input.brandName);
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
  const brandName = getDefaultBrandName(input.brandName);
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
  const from = process.env.EMAIL_FROM || getDefaultEmailFrom(input.brandName);

  if (!apiKey) {
      console.log("[email:dry-run] Recuperação de senha administrativa", {
      to: input.to,
      resetUrl: input.resetUrl
    });
    return;
  }

  const resend = new Resend(apiKey);

  await sendWithResend(resend, {
    from,
    to: input.to,
    subject: `Redefinir senha - ${getDefaultBrandName(input.brandName)}`,
    html: buildPasswordResetHtml(input),
    text: buildPasswordResetText(input)
  });
}

export function createAdminPasswordResetUrl(token: string, organization?: EmailOrganization | null) {
  return `${getAdminBaseUrl(organization)}/login/reset/${token}`;
}

function buildOrderPendingPaymentHtml(input: OrderPendingPaymentEmailInput) {
  const brandName = getDefaultBrandName(input.brandName);
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
  const brandName = getDefaultBrandName(input.brandName);
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
  const from = process.env.EMAIL_FROM || getDefaultEmailFrom(input.brandName);

  if (!apiKey) {
    console.log("[email:dry-run] Pedido pendente para envio", {
      to: input.to,
      orderCode: input.orderCode,
      orderUrl: input.orderUrl
    });
    return;
  }

  const resend = new Resend(apiKey);

  await sendWithResend(resend, {
    from,
    to: input.to,
    subject: `Pedido recebido - ${input.eventTitle}`,
    html: buildOrderPendingPaymentHtml(input),
    text: buildOrderPendingPaymentText(input)
  });
}

function buildOrderExpiredHtml(input: OrderExpiredEmailInput) {
  const brandName = getDefaultBrandName(input.brandName);
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
  const brandName = getDefaultBrandName(input.brandName);
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
  const from = process.env.EMAIL_FROM || getDefaultEmailFrom(input.brandName);

  if (!apiKey) {
    console.log("[email:dry-run] Pedido expirado para envio", {
      to: input.to,
      orderCode: input.orderCode,
      orderUrl: input.orderUrl
    });
    return;
  }

  const resend = new Resend(apiKey);

  await sendWithResend(resend, {
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

  await sendWithResend(resend, {
    from,
    to: input.to,
    subject: "Código de aprovação - Guerra à Pornografia",
    html: buildUnlockApprovalHtml(input),
    text: buildUnlockApprovalText(input)
  });
}

function buildLeadCaptureConfirmationHtml(input: LeadCaptureConfirmationEmailInput) {
  const brandName = getDefaultBrandName(input.brandName);
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
  const from = process.env.EMAIL_FROM || getDefaultEmailFrom(input.brandName);

  if (!apiKey) {
    console.log("[email:dry-run] Confirmacao de lead", {
      to: input.to,
      eventTitle: input.eventTitle,
      whatsappGroupUrl: input.whatsappGroupUrl
    });
    return;
  }

  const resend = new Resend(apiKey);

  await sendWithResend(resend, {
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
    .map((line) => `<p style="margin: 0 0 10px;">${line}</p>`)
    .join("");
}

function normalizeEmailSubjectText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.:!?-]+$/g, "")
    .toLowerCase();
}

function stripDuplicatedLeadBroadcastSubject(body: string, subject: string) {
  const normalizedSubject = normalizeEmailSubjectText(subject);

  if (!normalizedSubject) {
    return body;
  }

  const lines = body.split("\n");
  const firstMeaningfulIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstMeaningfulIndex === -1) {
    return body;
  }

  const firstMeaningfulLine = lines[firstMeaningfulIndex] ?? "";

  if (normalizeEmailSubjectText(firstMeaningfulLine) !== normalizedSubject) {
    return body;
  }

  const cleanedLines = [...lines];
  cleanedLines.splice(firstMeaningfulIndex, 1);

  while (
    cleanedLines[firstMeaningfulIndex] !== undefined &&
    cleanedLines[firstMeaningfulIndex]?.trim().length === 0
  ) {
    cleanedLines.splice(firstMeaningfulIndex, 1);
  }

  return cleanedLines.join("\n").trim();
}

function resolveAbsoluteEmailImageUrl(imageUrl: string, publicBaseUrl?: string | null) {
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    const baseUrl = (publicBaseUrl || getPublicBaseUrl()).replace(/\/$/, "");
    return `${baseUrl}${imageUrl}`;
  }

  return null;
}

function buildLeadBroadcastLogoUrl(input: LeadBroadcastEmailInput) {
  if (input.brandLogoUrl) {
    return resolveAbsoluteEmailImageUrl(input.brandLogoUrl, input.publicBaseUrl);
  }

  const brandName = (input.brandName || "").toLowerCase();

  if (brandName.includes("tcr")) {
    const baseUrl = (input.publicBaseUrl || getPublicBaseUrl()).replace(/\/$/, "");
    return `${baseUrl}/brands/tcr-logomarca.png`;
  }

  return null;
}

function buildLeadBroadcastInstagramIconUrl(input: LeadBroadcastEmailInput) {
  const baseUrl = (input.publicBaseUrl || getPublicBaseUrl()).replace(/\/$/, "");
  return `${baseUrl}/brands/instagram-email-icon.png`;
}

function buildLeadBroadcastImageUrl(input: LeadBroadcastEmailInput) {
  if (!input.imageUrl) {
    return null;
  }

  const sourceUrl = resolveAbsoluteEmailImageUrl(input.imageUrl, input.publicBaseUrl);

  if (!sourceUrl) {
    return null;
  }

  const baseUrl = (input.publicBaseUrl || getPublicBaseUrl()).replace(/\/$/, "");
  const params = new URLSearchParams({
    src: sourceUrl
  });

  if (input.imageWidth && input.imageHeight) {
    params.set("w", String(input.imageWidth));
    params.set("h", String(input.imageHeight));
  }

  if (input.imageCrop) {
    const crop = parseImageCrop(input.imageCrop);

    if (crop) {
      params.set("crop", JSON.stringify(crop));
    }
  }

  return `${baseUrl}/r/lead-email-image?${params.toString()}`;
}

function normalizeInstagramHandle(value?: string | null) {
  const text = (value || "").trim();

  if (!text) {
    return "";
  }

  if (text.startsWith("@")) {
    return text;
  }

  const match = text.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (match?.[1]) {
    return `@${match[1]}`;
  }

  return `@${text.replace(/^@+/, "")}`;
}

function normalizeInstagramHref(value?: string | null) {
  const text = (value || "").trim();

  if (!text) {
    return "";
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  return `https://instagram.com/${text.replace(/^@+/, "")}`;
}

function buildLeadBroadcastHtml(input: LeadBroadcastEmailInput) {
  const brandName = getDefaultBrandName(input.brandName);
  const sanitizedBody = stripDuplicatedLeadBroadcastSubject(input.body, input.subject);
  const imageUrl = buildLeadBroadcastImageUrl(input);
  const logoUrl = buildLeadBroadcastLogoUrl(input);
  const instagramIconUrl = buildLeadBroadcastInstagramIconUrl(input);
  const instagramDisplay = normalizeInstagramHandle(input.instagramUrl);
  const instagramHref = normalizeInstagramHref(input.instagramUrl);
  const imageBlock = imageUrl
    ? `
      <div style="margin: 0 0 24px;">
        <img
          src="${imageUrl}"
          alt="${input.eventTitle}"
          width="640"
          style="border: 0; border-radius: 18px; display: block; height: auto; line-height: 100%; margin: 0 auto; max-width: 640px; outline: none; text-decoration: none; width: 100%;"
        />
      </div>
    `
    : "";
  const ctaButton = input.ctaUrl
    ? `
      <p style="margin: 18px 0 0;">
        <a href="${input.ctaUrl}" style="background: #14924f; border-radius: 12px; color: white; display: inline-block; font-weight: 700; padding: 14px 22px; text-decoration: none;">
          ${input.ctaLabel || "Abrir link"}
        </a>
      </p>
    `
    : "";
  const supportLine = input.supportEmail
    ? `<p style="margin: 22px 0 0; color: #607089; font-size: 13px;">Suporte: ${input.supportEmail}</p>`
    : "";
  const unsubscribeLine = input.unsubscribeUrl
    ? `<p style="margin: 18px 0 0; color: #7a8798; font-size: 12px; text-align: center;">Não quer mais receber este tipo de e-mail? <a href="${input.unsubscribeUrl}" style="color: #607089;">Descadastrar</a></p>`
    : "";
  const trackingPixel = input.openTrackingUrl
    ? `<img src="${input.openTrackingUrl}" alt="" width="1" height="1" style="border: 0; display: block; height: 1px; opacity: 0; width: 1px;" />`
    : "";
  const instagramLine =
    instagramDisplay && instagramHref
      ? `
        <p style="margin: 18px 0 0; color: #607089; font-size: 13px;">
          <a href="${instagramHref}" style="align-items: center; color: #607089; display: inline-flex; gap: 8px; text-decoration: none;">
            <span style="display: inline-flex; flex: 0 0 auto; height: 22px; width: 22px;">
              <img src="${instagramIconUrl}" alt="" width="22" height="22" style="display: block; height: 22px; width: 22px;" />
            </span>
            ${instagramDisplay}
          </a>
        </p>
      `
      : "";

  return `
    <div style="background: #f3f6fb; margin: 0; padding: 24px 16px;">
      <div style="font-family: Arial, sans-serif; color: #1d2430; line-height: 1.55; margin: 0 auto; max-width: 720px;">
        <div style="background: #ffffff; border: 1px solid #e0e7f0; border-radius: 24px; box-shadow: 0 20px 60px rgba(10, 34, 26, 0.08); overflow: hidden; padding: 22px;">
          <div style="margin: 0 0 18px; text-align: center;">
            ${
              logoUrl
                ? `<div style="display: inline-block; margin: 0 auto 12px;">
                    <div style="background: #08251d; border-radius: 14px; box-shadow: 0 10px 24px rgba(6, 26, 20, 0.16); display: inline-block; padding: 10px 14px;">
                      <img src="${logoUrl}" alt="${brandName}" width="104" style="display: block; height: auto; margin: 0 auto; max-width: 104px;" />
                    </div>
                  </div>`
                : ""
            }
            <p style="margin: 0; color: #607089; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">${brandName}</p>
          </div>
          <p style="color: #425066; font-size: 16px; margin: 0 0 16px; text-align: left;">Olá, ${input.name}.</p>
          ${imageBlock}
          <div style="color: #243042; font-size: 16px;">
            ${renderBroadcastBodyAsHtml(sanitizedBody)}
          </div>
          ${ctaButton}
          ${instagramLine}
          ${supportLine}
          ${unsubscribeLine}
          ${trackingPixel}
        </div>
      </div>
    </div>
  `;
}

function buildLeadBroadcastText(input: LeadBroadcastEmailInput) {
  const sanitizedBody = stripDuplicatedLeadBroadcastSubject(input.body, input.subject);

  return [
    `Olá, ${input.name}.`,
    "",
    sanitizedBody,
    input.ctaUrl ? `${input.ctaLabel || "Abrir link"}: ${input.ctaUrl}` : null,
    input.instagramUrl ? `Instagram: ${normalizeInstagramHandle(input.instagramUrl)}` : null,
    input.supportEmail ? `Suporte: ${input.supportEmail}` : null,
    input.unsubscribeUrl ? `Descadastrar: ${input.unsubscribeUrl}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendLeadBroadcastEmail(input: LeadBroadcastEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const payload = createLeadBroadcastEmailPayload(input);

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

  await sendWithResend(resend, payload);
}

export function createLeadBroadcastEmailPayload(input: LeadBroadcastEmailInput): EmailPayload {
  const from = process.env.EMAIL_FROM || getDefaultEmailFrom(input.brandName);
  const headers = input.unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      }
    : undefined;

  return {
    from,
    to: input.to,
    subject: input.subject,
    html: buildLeadBroadcastHtml(input),
    text: buildLeadBroadcastText(input),
    headers
  };
}

export async function sendLeadBroadcastEmailBatch(inputs: LeadBroadcastEmailInput[]) {
  const apiKey = process.env.RESEND_API_KEY;

  if (inputs.length === 0) {
    return {
      sent: [] as Array<{ index: number; id: string }>,
      failed: [] as Array<{ index: number; message: string }>
    };
  }

  const payloads = inputs.map((input) => createLeadBroadcastEmailPayload(input));

  if (!apiKey) {
    console.log("[email:dry-run] Disparo de leads em lote", {
      count: inputs.length,
      recipients: inputs.map((input) => input.to)
    });

    return {
      sent: payloads.map((_, index) => ({
        index,
        id: `dry-run-${index + 1}`
      })),
      failed: [] as Array<{ index: number; message: string }>
    };
  }

  const resend = new Resend(apiKey);
  const result = await sendBatchWithResend(resend, payloads);
  const errors = result.errors ?? [];
  const failedIndexes = new Set(errors.map((entry) => entry.index));
  const sentIds = result.data ?? [];
  let successCursor = 0;
  const sent: Array<{ index: number; id: string }> = [];

  for (let index = 0; index < payloads.length; index += 1) {
    if (failedIndexes.has(index)) {
      continue;
    }

    const response = sentIds[successCursor];

    sent.push({
      index,
      id: response?.id || `batch-${index + 1}`
    });

    successCursor += 1;
  }

  return {
    sent,
    failed: errors.map((entry) => ({
      index: entry.index,
      message: entry.message
    }))
  };
}
