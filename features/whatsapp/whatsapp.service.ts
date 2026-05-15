type WhatsAppTemplateParameter = {
  type: "text";
  text: string;
};

type WhatsAppTemplateComponent = {
  type: "body";
  parameters: WhatsAppTemplateParameter[];
};

type SendTemplateMessageInput = {
  to?: string | null;
  templateName: string;
  parameters: string[];
};

export type PurchaseApprovedWhatsAppInput = {
  buyerName: string;
  buyerPhone?: string | null;
  eventTitle: string;
  orderCode: string;
  orderUrl: string;
};

export type CartAbandonmentWhatsAppInput = {
  buyerName: string;
  buyerPhone?: string | null;
  eventTitle: string;
  orderUrl: string;
  expiresAt: Date;
};

export type BulkWhatsAppRecipient = {
  name: string;
  phone?: string | null;
};

export type BulkWhatsAppResult = {
  sent: number;
  failed: number;
  results: Array<{
    phone?: string | null;
    name: string;
    ok: boolean;
    error?: string;
  }>;
};

function getWhatsAppApiVersion() {
  return process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v19.0";
}

function getWhatsAppConfig() {
  return {
    token: process.env.WHATSAPP_API_TOKEN?.trim(),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  };
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWhatsAppConfigured() {
  const config = getWhatsAppConfig();
  return Boolean(config.token && config.phoneNumberId);
}

export function formatPhone(phone?: string | null) {
  const digits = String(phone ?? "").replace(/\D/g, "").replace(/^0+/, "");

  if (!digits) {
    throw new Error("Telefone do WhatsApp nao informado.");
  }

  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  throw new Error("Telefone do WhatsApp invalido.");
}

async function sendTemplateMessage(input: SendTemplateMessageInput) {
  const config = getWhatsAppConfig();

  if (!config.token || !config.phoneNumberId) {
    throw new Error("WhatsApp Business API nao configurada.");
  }

  const to = formatPhone(input.to);
  const parameters: WhatsAppTemplateParameter[] = input.parameters.map((parameter) => ({
    type: "text",
    text: parameter
  }));
  const components: WhatsAppTemplateComponent[] = [
    {
      type: "body",
      parameters
    }
  ];
  const response = await fetch(
    `https://graph.facebook.com/${getWhatsAppApiVersion()}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: input.templateName,
          language: {
            code: "pt_BR"
          },
          components
        }
      })
    }
  );

  if (!response.ok) {
    let detail = await response.text().catch(() => "");

    try {
      const json = JSON.parse(detail) as { error?: { message?: string } };
      detail = json.error?.message || detail;
    } catch {
      // Mantem o texto bruto do provedor.
    }

    throw new Error(detail || `WhatsApp API retornou HTTP ${response.status}.`);
  }

  return response.json();
}

export async function sendPurchaseApprovedWhatsApp(input: PurchaseApprovedWhatsAppInput) {
  return sendTemplateMessage({
    to: input.buyerPhone,
    templateName: "compra_aprovada",
    parameters: [input.buyerName, input.eventTitle, input.orderCode, input.orderUrl]
  });
}

export async function sendCartAbandonmentWhatsApp(input: CartAbandonmentWhatsAppInput) {
  const minutesRemaining = Math.max(0, Math.ceil((input.expiresAt.getTime() - Date.now()) / 60000));

  return sendTemplateMessage({
    to: input.buyerPhone,
    templateName: "abandono_carrinho",
    parameters: [input.buyerName, input.eventTitle, String(minutesRemaining), input.orderUrl]
  });
}

export async function sendBulkWhatsApp<TRecipient extends BulkWhatsAppRecipient>(
  recipients: TRecipient[],
  templateName: string,
  buildParameters: (recipient: TRecipient) => string[]
): Promise<BulkWhatsAppResult> {
  const result: BulkWhatsAppResult = {
    sent: 0,
    failed: 0,
    results: []
  };

  for (const recipient of recipients) {
    try {
      await sendTemplateMessage({
        to: recipient.phone,
        templateName,
        parameters: buildParameters(recipient)
      });

      result.sent += 1;
      result.results.push({
        name: recipient.name,
        phone: recipient.phone,
        ok: true
      });
    } catch (error) {
      result.failed += 1;
      result.results.push({
        name: recipient.name,
        phone: recipient.phone,
        ok: false,
        error: normalizeError(error)
      });
      console.error("[WhatsApp] Falha no disparo em massa", {
        name: recipient.name,
        phone: recipient.phone,
        templateName,
        error: normalizeError(error)
      });
    }

    await wait(100);
  }

  return result;
}
