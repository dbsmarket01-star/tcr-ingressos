import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaymentHealth } from "@/features/settings/payment-health.service";
import { summarizeAsaasSplit } from "@/features/payments/split-report.service";
import { manualPresaleChecklistItems } from "./manual-presale-checklist";

type FinalCheckStatus = "READY" | "WARNING" | "BLOCKED";

type FinalCheckItem = {
  label: string;
  description: string;
  status: FinalCheckStatus;
  evidence?: string;
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

function status(value: boolean, blocked = false): FinalCheckStatus {
  if (value) {
    return "READY";
  }

  return blocked ? "BLOCKED" : "WARNING";
}

function summarize(items: FinalCheckItem[]) {
  return {
    ready: items.filter((item) => item.status === "READY").length,
    warning: items.filter((item) => item.status === "WARNING").length,
    blocked: items.filter((item) => item.status === "BLOCKED").length,
    total: items.length
  };
}

export async function getFinalPresaleChecklist(eventId?: string) {
  const events = await prisma.event.findMany({
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      startsAt: true,
      status: true
    }
  });
  const selectedEventId = eventId || events[0]?.id || "";
  const [health, event] = await Promise.all([
    getPaymentHealth(),
    selectedEventId
      ? prisma.event.findUnique({
          where: { id: selectedEventId },
          include: {
            lots: true,
            orders: {
              include: {
                payment: true,
                tickets: true
              },
              orderBy: {
                createdAt: "desc"
              }
            },
            tickets: {
              include: {
                checkIns: true
              }
            },
            checkIns: true
          }
        })
      : null
  ]);

  if (!event) {
    const item: FinalCheckItem = {
      label: "Evento selecionado",
      description: "Escolha um evento para revisar a pre-venda final.",
      status: "BLOCKED",
      action: "Cadastre ou selecione um evento.",
      href: "/admin/events/new"
    };

    return {
      filters: { eventId: selectedEventId },
      events,
      event: null,
      summary: summarize([item]),
      sale: [item],
      payment: [],
      operation: [],
      backoffice: [],
      manual: [],
      nextActions: [item],
      evidence: []
    };
  }

  await Promise.all(
    manualPresaleChecklistItems.map((item, index) =>
      prisma.eventPresaleCheck.upsert({
        where: {
          eventId_key: {
            eventId: event.id,
            key: item.key
          }
        },
        create: {
          eventId: event.id,
          key: item.key,
          label: item.label,
          description: item.description
        },
        update: {
          label: item.label,
          description: item.description
        }
      })
    )
  );

  const manualChecks = await prisma.eventPresaleCheck.findMany({
    where: {
      eventId: event.id
    },
    orderBy: {
      createdAt: "asc"
    }
  });
  const manualCheckOrder = new Map<string, number>(manualPresaleChecklistItems.map((item, index) => [item.key, index]));
  const manual = manualChecks
    .map((item) => ({
      id: item.id,
      key: item.key,
      label: item.label,
      description: item.description,
      checked: item.checked,
      note: item.note,
      checkedAt: item.checkedAt
    }))
    .sort((left, right) => (manualCheckOrder.get(left.key) ?? 999) - (manualCheckOrder.get(right.key) ?? 999));

  const activeLots = event.lots.filter((lot) => lot.status === "ACTIVE");
  const availableQuantity = event.lots.reduce(
    (sum, lot) => sum + Math.max(lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity, 0),
    0
  );
  const paidOrders = event.orders.filter((order) => order.status === "PAID");
  const pendingOrders = event.orders.filter((order) => order.status === "PENDING_PAYMENT");
  const approvedPayments = event.orders.filter((order) => order.payment?.status === PaymentStatus.APPROVED);
  const pixOrders = approvedPayments.filter(
    (order) => extractBillingType(order.payment?.rawPayload) === "PIX" || Boolean(order.payment?.pixQrCodePayload)
  );
  const cardOrders = approvedPayments.filter(
    (order) => extractBillingType(order.payment?.rawPayload) === "CREDIT_CARD"
  );
  const splitOrders = approvedPayments.filter((order) => summarizeAsaasSplit(order.payment?.rawPayload).totalInCents > 0);
  const emittedTickets = event.tickets.length;
  const activeTickets = event.tickets.filter((ticket) => ticket.status === "ACTIVE").length;
  const approvedCheckIns = event.checkIns.filter((checkIn) => checkIn.status === "APPROVED").length;
  const blockedCheckIns = event.checkIns.filter((checkIn) =>
    ["ALREADY_USED", "INVALID", "CANCELED"].includes(checkIn.status)
  ).length;
  const latestPaidOrder = paidOrders[0];
  const latestTicket = event.tickets[0];

  const sale: FinalCheckItem[] = [
    {
      label: "Pagina publica revisada",
      description: "Evento publicado com lote ativo, estoque e pagina acessivel para compra.",
      status: status(event.status === "PUBLISHED" && activeLots.length > 0 && availableQuantity > 0, true),
      evidence: `${activeLots.length} lote(s) ativo(s), ${availableQuantity} ingresso(s) disponiveis.`,
      action: "Publicar evento e conferir lotes ativos.",
      href: `/evento/${event.slug}`
    },
    {
      label: "Banner e comunicacao visual",
      description: "Banner real do evento cadastrado para conversao.",
      status: status(Boolean(event.bannerUrl)),
      evidence: event.bannerUrl ? "Banner configurado." : "Banner ainda nao configurado.",
      action: "Subir banner real do evento.",
      href: `/admin/events/${event.id}/edit`
    },
    {
      label: "Pixel/GTM para trafego pago",
      description: "Tracking configurado antes de rodar anuncios.",
      status: status(Boolean(event.metaPixelId || event.googleTagManagerId)),
      evidence: event.metaPixelId || event.googleTagManagerId ? "Tracking configurado." : "Sem Pixel/GTM no evento.",
      action: "Inserir Meta Pixel ID ou Google Tag Manager ID.",
      href: `/admin/events/${event.id}/edit`
    }
  ];

  const payment: FinalCheckItem[] = [
    {
      label: "Asaas em producao",
      description: "Gateway configurado para Pix e cartao.",
      status: status(health.asaas.enabled && health.asaas.apiKeyConfigured, true),
      evidence: `${health.provider} / ${health.asaas.environment}.`,
      action: "Configurar Asaas e chave API.",
      href: "/admin/settings"
    },
    {
      label: "Webhook Asaas",
      description: "Confirmacao automatica de pagamento ativa.",
      status: status(health.asaas.webhookTokenConfigured, true),
      evidence: health.asaas.webhookTokenConfigured ? "Token configurado." : "Token ausente.",
      action: "Configurar webhook definitivo.",
      href: "/admin/settings"
    },
    {
      label: "Compra Pix real",
      description: "Pedido Pix aprovado e ingresso emitido.",
      status: status(pixOrders.length > 0),
      evidence: `${pixOrders.length} pagamento(s) Pix aprovado(s).`,
      action: "Fazer compra teste via Pix.",
      href: `/evento/${event.slug}`
    },
    {
      label: "Compra cartao real",
      description: "Checkout transparente aprovado no cartao.",
      status: status(cardOrders.length > 0),
      evidence: `${cardOrders.length} pagamento(s) cartao aprovado(s).`,
      action: "Fazer compra teste via cartao.",
      href: `/evento/${event.slug}`
    },
    {
      label: "Split Asaas conferido",
      description: "Repasse enviado no pagamento aprovado.",
      status: status(splitOrders.length > 0),
      evidence: `${splitOrders.length} pagamento(s) com split retornado pelo Asaas.`,
      action: "Conferir carteira e regra de split.",
      href: "/admin/finance"
    }
  ];

  const operation: FinalCheckItem[] = [
    {
      label: "Ingresso com QR Code",
      description: "Pagamento aprovado gerou ingresso acessivel pelo cliente.",
      status: status(emittedTickets > 0),
      evidence: `${emittedTickets} ingresso(s) emitido(s), ${activeTickets} ativo(s).`,
      action: "Abrir ingresso teste.",
      href: latestTicket ? `/ingresso/${latestTicket.code}` : `/admin/tickets?eventId=${event.id}`
    },
    {
      label: "Check-in aprovado",
      description: "Equipe conseguiu validar um QR Code real.",
      status: status(approvedCheckIns > 0),
      evidence: `${approvedCheckIns} entrada(s) aprovada(s).`,
      action: "Fazer leitura teste no celular.",
      href: "/admin/check-in"
    },
    {
      label: "Bloqueio de reutilizacao",
      description: "O mesmo QR Code precisa bloquear segunda leitura.",
      status: status(blockedCheckIns > 0),
      evidence: `${blockedCheckIns} leitura(s) bloqueada(s).`,
      action: "Tentar ler novamente um ingresso ja utilizado.",
      href: "/admin/check-in"
    }
  ];

  const backoffice: FinalCheckItem[] = [
    {
      label: "Suporte encontra pedido",
      description: "Atendimento consegue buscar pedido, cliente e ingresso.",
      status: status(Boolean(latestPaidOrder)),
      evidence: latestPaidOrder ? `Pedido ${latestPaidOrder.code} disponivel.` : "Nenhum pedido pago encontrado.",
      action: "Buscar pedido teste no suporte.",
      href: latestPaidOrder ? `/admin/support?q=${latestPaidOrder.code}` : "/admin/support"
    },
    {
      label: "Financeiro acompanha venda",
      description: "Financeiro mostra faturamento, pagamento e split.",
      status: status(approvedPayments.length > 0),
      evidence: `${approvedPayments.length} pagamento(s) aprovado(s).`,
      action: "Abrir financeiro filtrado.",
      href: `/admin/finance?eventId=${event.id}`
    },
    {
      label: "Reservas pendentes sob controle",
      description: "Pedidos pendentes precisam expirar/liberar estoque.",
      status: pendingOrders.length <= 5 ? "READY" : "WARNING",
      evidence: `${pendingOrders.length} pedido(s) pendente(s).`,
      action: "Rodar liberacao de reservas vencidas.",
      href: `/admin/orders?eventId=${event.id}&status=PENDING_PAYMENT`
    }
  ];

  const manualPending = manual.filter((item) => !item.checked);
  const allItems = [
    ...sale,
    ...payment,
    ...operation,
    ...backoffice,
    ...manualPending.map((item): FinalCheckItem => ({
      label: item.label,
      description: item.description,
      status: "WARNING",
      evidence: item.note || "Item manual ainda nao marcado.",
      action: "Marcar como feito depois do teste real.",
      href: `/admin/final-presale?eventId=${event.id}#manual`
    }))
  ];
  const priority = { BLOCKED: 0, WARNING: 1, READY: 2 };
  const nextActions = allItems
    .filter((item) => item.status !== "READY")
    .sort((a, b) => priority[a.status] - priority[b.status])
    .slice(0, 8);

  return {
    filters: { eventId: event.id },
    events,
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      startsAt: event.startsAt,
      status: event.status,
      availableQuantity,
      paidOrders: paidOrders.length,
      approvedPayments: approvedPayments.length,
      pixPayments: pixOrders.length,
      cardPayments: cardOrders.length,
      splitPayments: splitOrders.length,
      emittedTickets,
      approvedCheckIns,
      blockedCheckIns
    },
    summary: summarize(allItems),
    sale,
    payment,
    operation,
    backoffice,
    manual,
    nextActions,
    evidence: [
      latestPaidOrder ? { label: "Pedido pago recente", value: latestPaidOrder.code, href: `/admin/orders/${latestPaidOrder.code}` } : null,
      latestTicket ? { label: "Ingresso recente", value: latestTicket.code, href: `/ingresso/${latestTicket.code}` } : null
    ].filter((item): item is { label: string; value: string; href: string } => Boolean(item))
  };
}
