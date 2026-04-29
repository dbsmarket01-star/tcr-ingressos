import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaymentHealth } from "@/features/settings/payment-health.service";
import { getPublicEventUrl } from "@/lib/public-url";

type LaunchStatus = "READY" | "WARNING" | "BLOCKED";
type EventScope = string[] | null | undefined;

type LaunchItem = {
  label: string;
  description: string;
  status: LaunchStatus;
  action?: string;
  href?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function extractPaymentPayload(rawPayload: unknown) {
  const root = asRecord(rawPayload);
  const nestedPayment = asRecord(root?.payment);
  return nestedPayment ?? root;
}

function extractBillingType(rawPayload: unknown) {
  const payload = extractPaymentPayload(rawPayload);
  return typeof payload?.billingType === "string" ? payload.billingType : null;
}

function getStatus(value: boolean, blocked = true): LaunchStatus {
  if (value) {
    return "READY";
  }

  return blocked ? "BLOCKED" : "WARNING";
}

function countSummary(items: LaunchItem[]) {
  return {
    ready: items.filter((item) => item.status === "READY").length,
    warning: items.filter((item) => item.status === "WARNING").length,
    blocked: items.filter((item) => item.status === "BLOCKED").length,
    total: items.length
  };
}

function sortNextActions(items: LaunchItem[]) {
  const priority = {
    BLOCKED: 0,
    WARNING: 1,
    READY: 2
  };

  return items
    .filter((item) => item.status !== "READY")
    .sort((left, right) => priority[left.status] - priority[right.status])
    .slice(0, 6);
}

export async function listLaunchEvents(allowedEventIds?: EventScope) {
  return prisma.event.findMany({
    where: allowedEventIds ? { id: { in: allowedEventIds } } : undefined,
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      startsAt: true,
      status: true
    }
  });
}

export async function getLaunchChecklist(eventId?: string, allowedEventIds?: EventScope) {
  const events = await listLaunchEvents(allowedEventIds);
  const selectedEventId = eventId || events[0]?.id || "";
  const [health, event] = await Promise.all([
    getPaymentHealth(),
    selectedEventId
      ? prisma.event.findFirst({
          where: {
            AND: [{ id: selectedEventId }, ...(allowedEventIds ? [{ id: { in: allowedEventIds } }] : [])]
          },
          include: {
            lots: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
            },
            orders: {
              include: {
                payment: true,
                tickets: {
                  select: {
                    id: true
                  }
                }
              },
              orderBy: {
                createdAt: "desc"
              }
            },
            tickets: {
              select: {
                id: true,
                status: true
              }
            },
            checkIns: {
              select: {
                id: true,
                status: true
              }
            }
          }
        })
      : null
  ]);

  if (!event) {
    return {
      filters: {
        eventId: selectedEventId
      },
      events,
      event: null,
      summary: countSummary([
        {
          label: "Evento selecionado",
          description: "Escolha um evento para revisar o lancamento.",
          status: "BLOCKED",
          action: "Cadastre ou selecione um evento."
        }
      ]),
      content: [
        {
          label: "Evento selecionado",
          description: "Escolha um evento para revisar o lancamento.",
          status: "BLOCKED" as const,
          action: "Cadastre ou selecione um evento.",
          href: undefined
        }
      ],
      sales: [],
      payments: [],
      operation: [],
      nextActions: [
        {
          label: "Evento selecionado",
          description: "Escolha um evento para revisar o lancamento.",
          status: "BLOCKED" as const,
          action: "Cadastre ou selecione um evento.",
          href: "/admin/events/new"
        }
      ],
      recentPaidOrders: []
    };
  }

  const activeLots = event.lots.filter((lot) => lot.status === "ACTIVE");
  const totalCapacity = event.lots.reduce((sum, lot) => sum + lot.totalQuantity, 0);
  const soldQuantity = event.lots.reduce((sum, lot) => sum + lot.soldQuantity, 0);
  const reservedQuantity = event.lots.reduce((sum, lot) => sum + lot.reservedQuantity, 0);
  const availableQuantity = Math.max(totalCapacity - soldQuantity - reservedQuantity, 0);
  const paidOrders = event.orders.filter((order) => order.status === "PAID");
  const approvedPayments = event.orders.filter((order) => order.payment?.status === PaymentStatus.APPROVED);
  const pixPayments = approvedPayments.filter(
    (order) => extractBillingType(order.payment?.rawPayload) === "PIX" || Boolean(order.payment?.pixQrCodePayload)
  );
  const cardPayments = approvedPayments.filter(
    (order) => extractBillingType(order.payment?.rawPayload) === "CREDIT_CARD"
  );
  const issuedTickets = event.tickets.length;
  const usedTickets = event.tickets.filter((ticket) => ticket.status === "USED").length;
  const approvedCheckIns = event.checkIns.filter((checkIn) => checkIn.status === "APPROVED").length;
  const hasMapOrSectors = Boolean(event.eventMapImageUrl) || event.eventMapTemplate !== "AUTO" || activeLots.length > 0;

  const content: LaunchItem[] = [
    {
      label: "Evento publicado",
      description: "A pagina publica so vende quando o evento esta publicado.",
      status: getStatus(event.status === "PUBLISHED"),
      action: event.status === "PUBLISHED" ? undefined : "Publicar o evento.",
      href: `/admin/events/${event.id}`
    },
    {
      label: "Banner do evento",
      description: "Imagem principal aumenta conversao e deixa a pagina pronta para trafego.",
      status: getStatus(Boolean(event.bannerUrl), false),
      action: event.bannerUrl ? undefined : "Subir banner na edicao do evento.",
      href: `/admin/events/${event.id}/edit`
    },
    {
      label: "Mapa ou setores",
      description: "Ajuda o cliente a entender setores, preco e valor percebido.",
      status: getStatus(hasMapOrSectors, false),
      action: hasMapOrSectors ? undefined : "Escolher modelo de mapa, subir imagem ou criar lotes/setores ativos.",
      href: `/admin/events/${event.id}/edit`
    },
    {
      label: "SEO do evento",
      description: "Titulo, descricao e imagem ajudam Google e compartilhamentos.",
      status: getStatus(Boolean(event.seoTitle || event.title) && Boolean(event.seoDescription || event.description), false),
      action: event.seoTitle && event.seoDescription ? undefined : "Revisar SEO editavel do evento.",
      href: `/admin/events/${event.id}/edit`
    },
    {
      label: "Pixel/GTM/CAPI",
      description: "Tracking ajuda a medir anuncio, checkout e compra aprovada.",
      status:
        event.metaPixelId || event.googleTagManagerId || (event.metaPixelId && event.metaConversionsApiToken)
          ? "READY"
          : "WARNING",
      action:
        event.metaPixelId || event.googleTagManagerId || (event.metaPixelId && event.metaConversionsApiToken)
          ? undefined
          : "Configurar Meta Pixel, Conversions API ou Google Tag Manager no evento.",
      href: `/admin/events/${event.id}/edit`
    }
  ];

  const sales: LaunchItem[] = [
    {
      label: "Lote ativo",
      description: "Precisa existir pelo menos um lote ativo para o cliente comprar.",
      status: getStatus(activeLots.length > 0),
      action: activeLots.length > 0 ? undefined : "Criar ou ativar lote.",
      href: `/admin/events/${event.id}`
    },
    {
      label: "Estoque disponivel",
      description: "Venda depende de ingressos disponiveis fora das reservas.",
      status: getStatus(availableQuantity > 0),
      action: availableQuantity > 0 ? undefined : "Aumentar estoque, liberar reserva vencida ou abrir novo lote.",
      href: `/admin/events/${event.id}`
    },
    {
      label: "Taxas configuradas",
      description: "Taxas e impostos precisam estar configurados por lote quando forem cobrados.",
      status: activeLots.some((lot) => lot.serviceFeeBps > 0) ? "READY" : "WARNING",
      action: activeLots.some((lot) => lot.serviceFeeBps > 0) ? undefined : "Conferir se este evento deve cobrar taxa.",
      href: `/admin/events/${event.id}`
    },
    {
      label: "Parcelamento revisado",
      description: "Juros do cartao ficam visiveis apenas na escolha de parcelas.",
      status: activeLots.length > 0 ? "READY" : "WARNING",
      action: activeLots.length > 0 ? undefined : "Criar lote antes de revisar parcelamento.",
      href: `/admin/events/${event.id}`
    }
  ];

  const payments: LaunchItem[] = [
    {
      label: "Asaas ativo",
      description: "Pix e cartao transparentes dependem do provedor Asaas.",
      status: getStatus(health.asaas.enabled && health.asaas.apiKeyConfigured),
      action: health.asaas.enabled && health.asaas.apiKeyConfigured ? undefined : "Configurar PAYMENT_PROVIDER=ASAAS e ASAAS_API_KEY.",
      href: "/admin/settings"
    },
    {
      label: "Webhook Asaas",
      description: "Webhook confirma pagamento sem acao manual.",
      status: getStatus(health.asaas.webhookTokenConfigured),
      action: health.asaas.webhookTokenConfigured ? undefined : "Configurar token do webhook Asaas.",
      href: "/admin/settings"
    },
    {
      label: "Split configurado",
      description: "Repasse para socios precisa ter wallet e regra ativa.",
      status:
        health.asaas.splitEnabled && health.asaas.splitWalletsConfigured > 0 && health.asaas.splitRulesConfigured > 0
          ? "READY"
          : "WARNING",
      action:
        health.asaas.splitEnabled && health.asaas.splitWalletsConfigured > 0 && health.asaas.splitRulesConfigured > 0
          ? undefined
          : "Configurar split no painel de configuracoes.",
      href: "/admin/settings"
    },
    {
      label: "Compra Pix testada",
      description: "Confirma QR Code, webhook e emissao de ingresso por Pix.",
      status: pixPayments.length > 0 ? "READY" : "WARNING",
      action: pixPayments.length > 0 ? undefined : "Fazer uma compra teste via Pix neste evento.",
      href: getPublicEventUrl(event.slug)
    },
    {
      label: "Compra cartao testada",
      description: "Confirma checkout transparente, aprovacao e emissao de ingresso no cartao.",
      status: cardPayments.length > 0 ? "READY" : "WARNING",
      action: cardPayments.length > 0 ? undefined : "Fazer uma compra teste via cartao neste evento.",
      href: getPublicEventUrl(event.slug)
    }
  ];

  const operation: LaunchItem[] = [
    {
      label: "Ingressos emitidos",
      description: "Pagamento aprovado precisa gerar ingresso com QR Code.",
      status: issuedTickets > 0 ? "READY" : "WARNING",
      action: issuedTickets > 0 ? undefined : "Aprovar compra teste e conferir ingresso.",
      href: `/admin/tickets?eventId=${event.id}`
    },
    {
      label: "Check-in testado",
      description: "Entrada precisa validar QR Code e bloquear reutilizacao.",
      status: approvedCheckIns > 0 ? "READY" : "WARNING",
      action: approvedCheckIns > 0 ? undefined : "Fazer leitura teste na tela de check-in.",
      href: "/admin/check-in"
    },
    {
      label: "Pedidos auditaveis",
      description: "Pedidos precisam aparecer no painel com pagamento e ingressos vinculados.",
      status: paidOrders.length > 0 ? "READY" : "WARNING",
      action: paidOrders.length > 0 ? undefined : "Fazer uma compra teste paga.",
      href: `/admin/orders?eventId=${event.id}`
    }
  ];

  const allItems = [...content, ...sales, ...payments, ...operation];

  return {
    filters: {
      eventId: event.id
    },
    events,
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      status: event.status,
      startsAt: event.startsAt,
      totalCapacity,
      soldQuantity,
      reservedQuantity,
      availableQuantity,
      paidOrders: paidOrders.length,
      approvedPayments: approvedPayments.length,
      pixPayments: pixPayments.length,
      cardPayments: cardPayments.length,
      issuedTickets,
      usedTickets,
      approvedCheckIns,
      provider: health.provider as PaymentProvider | string
    },
    summary: countSummary(allItems),
    content,
    sales,
    payments,
    operation,
    nextActions: sortNextActions(allItems),
    recentPaidOrders: paidOrders.slice(0, 5)
  };
}
