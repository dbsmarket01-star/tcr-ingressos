import { prisma } from "@/lib/prisma";
import { getPaymentHealth } from "./payment-health.service";

type ReadinessStatus = "READY" | "WARNING" | "BLOCKED";

type ReadinessItem = {
  label: string;
  description: string;
  status: ReadinessStatus;
  action?: string;
};

function statusFrom(value: boolean, blocked = true): ReadinessStatus {
  if (value) {
    return "READY";
  }

  return blocked ? "BLOCKED" : "WARNING";
}

function isLocalUrl(value: string) {
  return value.includes("localhost") || value.includes("127.0.0.1");
}

function storageReady(health: Awaited<ReturnType<typeof getPaymentHealth>>) {
  if (health.uploads.provider === "SUPABASE_STORAGE") {
    return health.uploads.supabaseUrlConfigured && health.uploads.supabaseServiceRoleConfigured;
  }

  return health.uploads.provider !== "LOCAL" || health.uploads.localPersistent;
}

function isRecommendedHostingPlan(health: Awaited<ReturnType<typeof getPaymentHealth>>) {
  const provider = health.security.hostingProvider.toUpperCase();
  const plan = health.security.hostingPlan.toUpperCase();

  if (provider === "VERCEL") {
    return plan.includes("PRO") || plan.includes("TEAM") || plan.includes("ENTERPRISE");
  }

  return provider !== "LOCAL" && health.security.hostingPlan !== "Nao informado";
}

function isRecommendedDatabasePlan(health: Awaited<ReturnType<typeof getPaymentHealth>>) {
  const plan = health.database.plan.toUpperCase();
  return plan.includes("PRO") || plan.includes("PAID") || plan.includes("TEAM") || plan.includes("DEDICATED");
}

export async function getProductionReadiness() {
  const health = await getPaymentHealth();
  const [
    publishedEvents,
    activeLots,
    paidOrders,
    pendingOrders,
    paymentLogs,
    issuedTickets,
    checkIns,
    admins,
    localUploadedMedia
  ] = await Promise.all([
    prisma.event.count({ where: { status: "PUBLISHED" } }),
    prisma.ticketLot.count({ where: { status: "ACTIVE", event: { status: "PUBLISHED" } } }),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.payment.count(),
    prisma.ticket.count(),
    prisma.checkIn.count(),
    prisma.adminUser.count({ where: { isActive: true } }),
    prisma.event.count({
      where: {
        OR: [
          { bannerUrl: { startsWith: "/uploads/" } },
          { eventMapImageUrl: { startsWith: "/uploads/" } },
          { seoImageUrl: { startsWith: "/uploads/" } }
        ]
      }
    })
  ]);

  const deploy: ReadinessItem[] = [
    {
      label: "Banco de dados",
      description: "DATABASE_URL e DIRECT_URL precisam estar configuradas para aplicacao e migracoes.",
      status: statusFrom(health.database.databaseUrlConfigured && health.database.directUrlConfigured),
      action:
        health.database.databaseUrlConfigured && health.database.directUrlConfigured
          ? undefined
          : "Configurar DATABASE_URL e DIRECT_URL do Supabase/Postgres."
    },
    {
      label: "Pooling do Supabase",
      description: "A aplicacao deve usar pooler/pgbouncer e limite de conexoes para evitar gargalo em pico.",
      status: health.database.usesPooling ? "READY" : "WARNING",
      action: health.database.usesPooling
        ? undefined
        : "Usar DATABASE_URL com pgbouncer=true e connection_limit=1 ou limite equivalente do provedor."
    },
    {
      label: "Dominio publico",
      description: "NEXT_PUBLIC_APP_URL/APP_URL precisa apontar para o dominio final com HTTPS.",
      status: isLocalUrl(health.appUrl) || !health.security.appUrlUsesHttps ? "BLOCKED" : "READY",
      action:
        isLocalUrl(health.appUrl) || !health.security.appUrlUsesHttps
          ? "Configurar APP_URL e NEXT_PUBLIC_APP_URL com https://seudominio.com.br antes do trafego pago."
          : undefined
    },
    {
      label: "Segredo de sessao",
      description: "AUTH_SECRET protege cookies e sessoes internas.",
      status: statusFrom(health.security.authSecretConfigured),
      action: health.security.authSecretConfigured ? undefined : "Configurar AUTH_SECRET forte em producao."
    },
    {
      label: "Dominio interno do painel",
      description: "ADMIN_HOST deve restringir /admin e /login ao subdominio interno da operacao.",
      status: isLocalUrl(health.appUrl) ? "WARNING" : statusFrom(health.security.adminHostConfigured, false),
      action:
        isLocalUrl(health.appUrl) || health.security.adminHostConfigured
          ? undefined
          : "Configurar ADMIN_HOST=produtor.tcringressos.app.br na Vercel para ocultar o painel no dominio publico."
    },
    {
      label: "Rotina de expiracao",
      description: "CRON_SECRET protege a rota que libera reservas vencidas.",
      status: statusFrom(health.security.cronSecretConfigured),
      action: health.security.cronSecretConfigured ? undefined : "Configurar CRON_SECRET e agendar chamada recorrente."
    },
    {
      label: "E-mail transacional",
      description: "Resend precisa estar configurado para enviar pedidos e ingressos.",
      status: statusFrom(health.email.resendConfigured),
      action: health.email.resendConfigured ? undefined : "Configurar RESEND_API_KEY, EMAIL_FROM e dominio autenticado."
    },
    {
      label: "Login Google no checkout",
      description: "Google OAuth preenche nome e e-mail do comprador, mas nao bloqueia venda se ficar desligado.",
      status: health.google.clientIdConfigured && health.google.clientSecretConfigured ? "READY" : "WARNING",
      action:
        health.google.clientIdConfigured && health.google.clientSecretConfigured
          ? undefined
          : "Configurar GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET quando quiser ativar o botao Google."
    },
    {
      label: "Midia dos eventos",
      description: "Uploads locais funcionam em servidor com disco persistente. Em Vercel/ambiente sem disco, use storage externo.",
      status: storageReady(health) ? "READY" : "WARNING",
      action: storageReady(health)
        ? undefined
        : "Configurar Supabase Storage ou confirmar disco persistente antes do trafego pago."
    }
  ];

  const infrastructure: ReadinessItem[] = [
    {
      label: "Hospedagem de producao",
      description: `Hospedagem atual: ${health.security.hostingProvider} (${health.security.hostingPlan}). Para venda real, a recomendacao inicial e Vercel Pro ou plano superior.`,
      status: isLocalUrl(health.appUrl) ? "BLOCKED" : isRecommendedHostingPlan(health) ? "READY" : "WARNING",
      action: isLocalUrl(health.appUrl)
        ? "Escolher provedor e publicar a aplicacao antes de trocar o webhook definitivo."
        : isRecommendedHostingPlan(health)
          ? undefined
          : "Configurar HOSTING_PLAN=VERCEL_PRO apos upgrade ou escolher servidor/containers com capacidade equivalente."
    },
    {
      label: "Banco em plano de producao",
      description: `Banco atual: ${health.database.provider} (${health.database.plan}). Para trafego pago, use Supabase Pro ou Postgres gerenciado equivalente.`,
      status: isRecommendedDatabasePlan(health) ? "READY" : "WARNING",
      action: isRecommendedDatabasePlan(health)
        ? undefined
        : "Subir o Supabase para Pro antes de campanha maior e definir DATABASE_PLAN=SUPABASE_PRO nas variaveis."
    },
    {
      label: "Storage de imagens em producao",
      description: "Banner, mapa e imagem SEO nao podem depender de arquivo temporario se o deploy for serverless.",
      status: storageReady(health) || localUploadedMedia === 0 ? "READY" : "WARNING",
      action: storageReady(health) || localUploadedMedia === 0
        ? undefined
        : "Antes de anunciar, confirmar disco persistente ou migrar upload para Supabase Storage/S3/CDN."
    },
    {
      label: "Backup do banco",
      description: "Supabase precisa ter backup e acesso de emergencia conferidos manualmente.",
      status: "WARNING",
      action: "Conferir no Supabase: backups, senha do banco, acesso da conta e projeto correto."
    },
    {
      label: "Logs de pagamento",
      description: "Pagamentos criados e webhooks devem ficar registrados para auditoria e suporte.",
      status: paymentLogs > 0 ? "READY" : "WARNING",
      action: paymentLogs > 0 ? undefined : "Fazer uma compra teste para gerar log de pagamento."
    },
    {
      label: "Pedidos pendentes",
      description: "Pedidos pendentes devem expirar automaticamente para liberar estoque.",
      status: health.security.cronSecretConfigured ? "READY" : "BLOCKED",
      action: health.security.cronSecretConfigured
        ? pendingOrders > 0
          ? "Agendar a rotina e acompanhar se pedidos pendentes vencidos somem."
          : undefined
        : "Configurar CRON_SECRET e agendar a rota de expiracao."
    }
  ];

  const payments: ReadinessItem[] = [
    {
      label: "Asaas ativo",
      description: "Pagamento Pix/cartao precisa estar apontando para Asaas.",
      status: statusFrom(health.asaas.enabled),
      action: health.asaas.enabled ? undefined : "Definir PAYMENT_PROVIDER=ASAAS."
    },
    {
      label: "Chave Asaas",
      description: "ASAAS_API_KEY precisa estar configurada.",
      status: statusFrom(health.asaas.apiKeyConfigured),
      action: health.asaas.apiKeyConfigured ? undefined : "Configurar ASAAS_API_KEY."
    },
    {
      label: "Webhook Asaas",
      description: "ASAAS_WEBHOOK_TOKEN precisa bater com o token configurado no painel Asaas.",
      status: statusFrom(health.asaas.webhookTokenConfigured && !health.security.appUrlIsLocal),
      action:
        health.asaas.webhookTokenConfigured && !health.security.appUrlIsLocal
          ? undefined
          : "Configurar webhook definitivo no Asaas usando dominio real e o token de producao."
    },
    {
      label: "Ambiente Asaas",
      description: "Confirme se esta em Producao antes de vender ao publico.",
      status: health.asaas.environment === "Producao" ? "READY" : "WARNING",
      action: health.asaas.environment === "Producao" ? undefined : "Trocar ASAAS_API_URL/API_KEY para producao quando for vender."
    },
    {
      label: "Split Asaas",
      description: "Repasse para socios depende de ASAAS_SPLIT_ENABLED e walletIds com percentual ou valor fixo.",
      status:
        health.asaas.splitEnabled && health.asaas.splitWalletsConfigured > 0 && health.asaas.splitRulesConfigured > 0
          ? "READY"
          : "WARNING",
      action:
        health.asaas.splitEnabled && health.asaas.splitWalletsConfigured > 0 && health.asaas.splitRulesConfigured > 0
          ? undefined
          : "Configurar walletIds dos socios e regras de split antes de operar repasse automatico."
    }
  ];

  const operation: ReadinessItem[] = [
    {
      label: "Evento publicado",
      description: "Precisa existir pelo menos um evento publicado.",
      status: statusFrom(publishedEvents > 0),
      action: publishedEvents > 0 ? undefined : "Publicar evento."
    },
    {
      label: "Lotes ativos",
      description: "Evento publicado precisa ter lote ativo para venda.",
      status: statusFrom(activeLots > 0),
      action: activeLots > 0 ? undefined : "Criar/ativar lotes."
    },
    {
      label: "Usuarios internos",
      description: "Equipe precisa ter acesso ativo para operar painel e check-in.",
      status: statusFrom(admins > 0),
      action: admins > 0 ? undefined : "Criar usuarios internos."
    },
    {
      label: "Pedido pago testado",
      description: "Antes de trafego pago, faca pelo menos uma compra real de teste.",
      status: paidOrders > 0 ? "READY" : "WARNING",
      action: paidOrders > 0 ? undefined : "Fazer compra teste com Pix e cartao."
    },
    {
      label: "Ingressos emitidos",
      description: "Pagamento aprovado precisa gerar ingresso com QR Code.",
      status: issuedTickets > 0 ? "READY" : "WARNING",
      action: issuedTickets > 0 ? undefined : "Aprovar pagamento teste e conferir ingresso."
    },
    {
      label: "Check-in testado",
      description: "Portaria precisa validar QR Code e bloquear reutilizacao.",
      status: checkIns > 0 ? "READY" : "WARNING",
      action: checkIns > 0 ? undefined : "Fazer leitura teste em celular real."
    }
  ];

  const goLive: ReadinessItem[] = [
    {
      label: "Compra Pix real",
      description: "Pelo menos uma pessoa precisa comprar via Pix e receber ingresso por e-mail.",
      status: paidOrders > 0 ? "READY" : "WARNING",
      action: paidOrders > 0 ? undefined : "Executar compra Pix real no dominio final."
    },
    {
      label: "Compra cartao real",
      description: "Cartao precisa aprovar, atualizar pedido por webhook e gerar QR Code.",
      status: paidOrders > 0 ? "READY" : "WARNING",
      action: paidOrders > 0 ? "Conferir se existe pelo menos uma aprovacao por cartao no painel de pedidos." : "Executar compra cartao real."
    },
    {
      label: "Teste em celular",
      description: "Pagina publica, checkout, pedido e check-in precisam funcionar em Android e iPhone.",
      status: "WARNING",
      action: "Pedir para 3 a 5 pessoas testarem em aparelhos reais antes do anuncio."
    },
    {
      label: "Pixel e GTM por evento",
      description: "Evento real deve ter tracking configurado para medir trafego pago.",
      status: "WARNING",
      action: "Conferir Meta Pixel/GTM dentro da edicao do evento antes da campanha."
    }
  ];

  const allItems = [...deploy, ...infrastructure, ...payments, ...operation, ...goLive];
  const blocked = allItems.filter((item) => item.status === "BLOCKED").length;
  const warning = allItems.filter((item) => item.status === "WARNING").length;
  const ready = allItems.filter((item) => item.status === "READY").length;

  return {
    summary: {
      ready,
      warning,
      blocked,
      total: allItems.length
    },
    deploy,
    infrastructure,
    payments,
    operation,
    goLive,
    links: {
      asaasWebhook: `${health.asaas.webhookUrl}?token=ASAAS_WEBHOOK_TOKEN`,
      cron: `${health.appUrl}/api/maintenance/expire-orders?token=CRON_SECRET`,
      cronBearer: `${health.appUrl}/api/maintenance/expire-orders`,
      appUrl: health.appUrl,
      health: `${health.appUrl}/api/health`,
      infrastructureDocs: "/docs/infrastructure-plan.md",
      docs: "/docs/production-readiness.md"
    }
  };
}
