import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createPublicOrderUrl } from "@/features/email/email.service";

const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v22.0";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase();
  return email ? sha256(email) : undefined;
}

function normalizePhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") || "";
  return digits ? sha256(digits) : undefined;
}

async function getPaidOrderForMeta(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        select: {
          name: true,
          email: true,
          phone: true
        }
      },
      event: {
        include: {
          organization: {
            select: {
              name: true,
              publicDomain: true
            }
          }
        }
      },
      items: {
        include: {
          lot: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });
}

type PaidOrderForMeta = NonNullable<Awaited<ReturnType<typeof getPaidOrderForMeta>>>;

function buildUserData(order: PaidOrderForMeta) {
  const em = normalizeEmail(order.customer.email);
  const ph = normalizePhone(order.customer.phone);

  return Object.fromEntries(
    Object.entries({
      em: em ? [em] : undefined,
      ph: ph ? [ph] : undefined,
      client_ip_address: order.clientIpAddress || undefined,
      client_user_agent: order.clientUserAgent || undefined,
      fbp: order.metaFbp || undefined,
      fbc: order.metaFbc || undefined
    }).filter(([, value]) => value !== undefined)
  );
}

export async function trackMetaPurchaseForPaidOrder(orderId: string) {
  const order = await getPaidOrderForMeta(orderId);

  if (!order || order.status !== "PAID" || order.metaPurchaseTrackedAt) {
    return { tracked: false as const, reason: "not_needed" as const };
  }

  if (!order.event.metaPixelId || !order.event.metaConversionsApiToken) {
    return { tracked: false as const, reason: "tracking_not_configured" as const };
  }

  const eventSourceUrl =
    order.landingPage || createPublicOrderUrl(order.code, order.event.organization);

  const userData = buildUserData(order);
  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor((order.paidAt || order.updatedAt).getTime() / 1000),
        event_id: order.code,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data: userData,
        custom_data: {
          currency: order.currency || "BRL",
          value: Number((order.totalInCents / 100).toFixed(2)),
          order_id: order.code,
          content_name: order.event.title,
          content_type: "product",
          contents: order.items.map((item) => ({
            id: item.lotId,
            quantity: item.quantity,
            item_price: Number(((item.totalInCents + item.serviceFeeInCents) / Math.max(item.quantity, 1) / 100).toFixed(2)),
            title: item.lot.name
          })),
          num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
          utm_source: order.utmSource || undefined,
          utm_medium: order.utmMedium || undefined,
          utm_campaign: order.utmCampaign || undefined,
          utm_content: order.utmContent || undefined,
          utm_term: order.utmTerm || undefined
        }
      }
    ],
    test_event_code: order.event.metaTestEventCode || undefined
  };

  const endpoint = new URL(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${order.event.metaPixelId}/events`
  );
  endpoint.searchParams.set("access_token", order.event.metaConversionsApiToken);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Meta CAPI rejeitou a venda: ${response.status} ${body}`.trim());
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      metaPurchaseTrackedAt: new Date()
    }
  });

  return { tracked: true as const };
}
