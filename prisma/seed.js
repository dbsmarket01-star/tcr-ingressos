const {
  PrismaClient,
  AdminRole,
  EventStatus,
  LotStatus,
  PlanStatus,
  SubscriptionInterval
} = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const A2_IMERGIDOS_LOGO_URL =
  process.env.SEED_A2_LOGO_URL ||
  "https://xbvrlheevlchxdkrsbnq.supabase.co/storage/v1/object/public/event-media/brands/a2-imergidos-logo.png";
const A2_IMERGIDOS_CONECTADOS_BANNER_URL =
  process.env.SEED_A2_CONECTADOS_BANNER_URL ||
  "https://xbvrlheevlchxdkrsbnq.supabase.co/storage/v1/object/public/event-media/brands/a2-imergidos-conectados-banner.png";

async function upsertPlan(plan) {
  await prisma.subscriptionPlan.upsert({
    where: {
      code: plan.code
    },
    update: plan,
    create: plan
  });
}

async function ensureOrganization(input) {
  return prisma.organization.upsert({
    where: {
      slug: input.slug
    },
    update: {
      name: input.name,
      publicDomain: input.publicDomain ?? null,
      adminDomain: input.adminDomain ?? null,
      logoUrl: input.logoUrl ?? null,
      primaryColor: input.primaryColor ?? null,
      secondaryColor: input.secondaryColor ?? null,
      supportEmail: input.supportEmail ?? null,
      supportPhone: input.supportPhone ?? null,
      isActive: true
    },
    create: {
      slug: input.slug,
      name: input.name,
      publicDomain: input.publicDomain ?? null,
      adminDomain: input.adminDomain ?? null,
      logoUrl: input.logoUrl ?? null,
      primaryColor: input.primaryColor ?? null,
      secondaryColor: input.secondaryColor ?? null,
      supportEmail: input.supportEmail ?? null,
      supportPhone: input.supportPhone ?? null,
      isActive: true
    }
  });
}

async function ensureCompanySettings(input) {
  return prisma.companySettings.upsert({
    where: {
      organizationId: input.organizationId
    },
    update: {
      companyName: input.companyName,
      tradeName: input.tradeName,
      supportEmail: input.supportEmail,
      supportPhone: input.supportPhone ?? null,
      instagramUrl: input.instagramUrl ?? null,
      facebookUrl: input.facebookUrl ?? null,
      youtubeUrl: input.youtubeUrl ?? null,
      whatsappUrl: input.whatsappUrl ?? null,
      defaultCurrency: "BRL",
      platformFeeBps: input.platformFeeBps
    },
    create: {
      organizationId: input.organizationId,
      companyName: input.companyName,
      tradeName: input.tradeName,
      document: input.document,
      supportEmail: input.supportEmail,
      supportPhone: input.supportPhone ?? null,
      instagramUrl: input.instagramUrl ?? null,
      facebookUrl: input.facebookUrl ?? null,
      youtubeUrl: input.youtubeUrl ?? null,
      whatsappUrl: input.whatsappUrl ?? null,
      defaultCurrency: "BRL",
      platformFeeBps: input.platformFeeBps
    }
  });
}

async function ensureAdminUser(input) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.adminUser.upsert({
    where: {
      email: input.email
    },
    update: {
      organizationId: input.organizationId,
      name: input.name,
      passwordHash,
      role: input.role,
      isActive: true,
      accessAllEvents: true,
      allowedEventIds: []
    },
    create: {
      organizationId: input.organizationId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      isActive: true,
      accessAllEvents: true,
      allowedEventIds: []
    }
  });
}

async function ensureA2ImergidosConectadosEvent(organizationId, createdById) {
  const event = await prisma.event.upsert({
    where: {
      slug: "a2-imergidos-conectados"
    },
    update: {
      organizationId,
      title: "A2 Imergidos + Conectados",
      subtitle: "Conferência A2 Imergidos",
      description:
        "Evento A2 Imergidos + Conectados recuperado dentro da operação TCR, com venda pública ativa e lote preservando vendas existentes.",
      bannerUrl: A2_IMERGIDOS_CONECTADOS_BANNER_URL,
      bannerPosition: "center center",
      bannerCrop: JSON.stringify({ x: 50, y: 50, zoom: 1 }),
      startsAt: new Date("2026-06-27T09:00:00-03:00"),
      endsAt: new Date("2026-06-27T21:00:00-03:00"),
      venueName: "A definir",
      venueAddress: "Santana do Livramento",
      city: "Santana do Livramento",
      state: "RS",
      status: EventStatus.PUBLISHED,
      salesStartsAt: new Date("2026-05-01T09:00:00-03:00"),
      salesEndsAt: new Date("2026-06-27T08:59:00-03:00"),
      importantInfo: "Apresente o ingresso com QR Code na entrada do evento.",
      seoTitle: "A2 Imergidos + Conectados | TCR Ingressos",
      seoDescription: "Compre ingressos oficiais para o A2 Imergidos + Conectados.",
      seoImageUrl: A2_IMERGIDOS_CONECTADOS_BANNER_URL,
      supportWhatsappUrl: null,
      couponsEnabled: false,
      leadCaptureEnabled: false,
      conversionSocialProofText: "Ingresso oficial emitido pela TCR Ingressos.",
      conversionUrgencyText: "Vagas limitadas por lote.",
      conversionCtaText: "Garantir ingresso",
      createdById
    },
    create: {
      organizationId,
      title: "A2 Imergidos + Conectados",
      slug: "a2-imergidos-conectados",
      subtitle: "Conferência A2 Imergidos",
      description:
        "Evento A2 Imergidos + Conectados recuperado dentro da operação TCR, com venda pública ativa e lote preservando vendas existentes.",
      bannerUrl: A2_IMERGIDOS_CONECTADOS_BANNER_URL,
      bannerPosition: "center center",
      bannerCrop: JSON.stringify({ x: 50, y: 50, zoom: 1 }),
      startsAt: new Date("2026-06-27T09:00:00-03:00"),
      endsAt: new Date("2026-06-27T21:00:00-03:00"),
      venueName: "A definir",
      venueAddress: "Santana do Livramento",
      city: "Santana do Livramento",
      state: "RS",
      status: EventStatus.PUBLISHED,
      salesStartsAt: new Date("2026-05-01T09:00:00-03:00"),
      salesEndsAt: new Date("2026-06-27T08:59:00-03:00"),
      importantInfo: "Apresente o ingresso com QR Code na entrada do evento.",
      seoTitle: "A2 Imergidos + Conectados | TCR Ingressos",
      seoDescription: "Compre ingressos oficiais para o A2 Imergidos + Conectados.",
      seoImageUrl: A2_IMERGIDOS_CONECTADOS_BANNER_URL,
      supportWhatsappUrl: null,
      couponsEnabled: false,
      leadCaptureEnabled: false,
      conversionSocialProofText: "Ingresso oficial emitido pela TCR Ingressos.",
      conversionUrgencyText: "Vagas limitadas por lote.",
      conversionCtaText: "Garantir ingresso",
      createdById
    }
  });

  const existingLot = await prisma.ticketLot.findFirst({
    where: {
      eventId: event.id,
      name: "Ingresso Casal"
    }
  });

  if (existingLot) {
    await prisma.ticketLot.update({
      where: {
        id: existingLot.id
      },
      data: {
        description: "Ingresso para casal no A2 Imergidos + Conectados.",
        priceInCents: 54700,
        serviceFeeBps: 0,
        pixDiscountPercentBps: 0,
        pixDiscountFixedInCents: 0,
        cardInterestBpsPerInstallment: 0,
        cardInterestStartsAtInstallment: 2,
        totalQuantity: 500,
        minPerOrder: 1,
        maxPerOrder: 10,
        salesStartsAt: new Date("2026-05-01T09:00:00-03:00"),
        salesEndsAt: new Date("2026-06-27T08:59:00-03:00"),
        sortOrder: 10,
        status: LotStatus.ACTIVE
      }
    });
  } else {
    await prisma.ticketLot.create({
      data: {
        eventId: event.id,
        name: "Ingresso Casal",
        description: "Ingresso para casal no A2 Imergidos + Conectados.",
        priceInCents: 54700,
        serviceFeeBps: 0,
        pixDiscountPercentBps: 0,
        pixDiscountFixedInCents: 0,
        cardInterestBpsPerInstallment: 0,
        cardInterestStartsAtInstallment: 2,
        totalQuantity: 500,
        minPerOrder: 1,
        maxPerOrder: 10,
        salesStartsAt: new Date("2026-05-01T09:00:00-03:00"),
        salesEndsAt: new Date("2026-06-27T08:59:00-03:00"),
        sortOrder: 10,
        status: LotStatus.ACTIVE
      }
    });
  }

  return event;
}

async function upsertDefaultProtectionPolicy() {
  const policy = await prisma.protectionPolicy.upsert({
    where: {
      slug: "default"
    },
    update: {
      name: "Politica padrao Guerra a Pornografia",
      description: "Politica inicial do MVP com foco em pornografia e defesa anti-bypass.",
      isActive: true
    },
    create: {
      slug: "default",
      name: "Politica padrao Guerra a Pornografia",
      description: "Politica inicial do MVP com foco em pornografia e defesa anti-bypass.",
      isActive: true
    }
  });

  const source = await prisma.blocklistSource.upsert({
    where: {
      policyId_code: {
        policyId: policy.id,
        code: "core-pornography"
      }
    },
    update: {
      name: "Core pornography blocklist",
      description: "Lista inicial para o MVP.",
      isEnabled: true,
      priority: 10
    },
    create: {
      policyId: policy.id,
      code: "core-pornography",
      name: "Core pornography blocklist",
      description: "Lista inicial para o MVP.",
      isEnabled: true,
      priority: 10
    }
  });

  const entries = [
    ["porn", "URL_KEYWORD"],
    ["xxx", "URL_KEYWORD"],
    ["sex", "URL_KEYWORD"],
    ["pornhub.com", "DOMAIN"],
    ["xvideos.com", "DOMAIN"],
    ["redtube.com", "DOMAIN"],
    ["xnxx.com", "DOMAIN"],
    ["onlyfans.com", "DOMAIN"]
  ];

  for (const [value, type] of entries) {
    await prisma.blocklistEntry.upsert({
      where: {
        sourceId_value_type: {
          sourceId: source.id,
          value,
          type
        }
      },
      update: {
        isActive: true
      },
      create: {
        sourceId: source.id,
        value,
        type,
        isActive: true
      }
    });
  }
}

async function main() {
  const tcrAdminEmail = process.env.SEED_ADMIN_EMAIL || "admin@tcringressos.com.br";
  const tcrAdminPassword = process.env.SEED_ADMIN_PASSWORD || "troque-esta-senha";
  const tcrAdminName = process.env.SEED_ADMIN_NAME || "Administrador TCR";
  const tcrSupportEmail = process.env.TCR_SUPPORT_EMAIL || "tcrshowseventos@gmail.com";

  const tcr = await ensureOrganization({
    slug: "tcr-ingressos",
    name: "TCR Ingressos",
    publicDomain: "tcringressos.app.br",
    adminDomain: "produtor.tcringressos.app.br",
    logoUrl: "/brands/tcr-logomarca.png",
    primaryColor: "#008020",
    secondaryColor: "#ffffff",
    supportEmail: tcrSupportEmail
  });

  await ensureCompanySettings({
    organizationId: tcr.id,
    companyName: "TCR Ingressos",
    tradeName: "TCR Ingressos",
    document: "00.000.000/0001-00",
    supportEmail: tcrSupportEmail,
    platformFeeBps: 1000
  });

  const tcrAdmin = await ensureAdminUser({
    organizationId: tcr.id,
    name: tcrAdminName,
    email: tcrAdminEmail,
    password: tcrAdminPassword,
    role: AdminRole.OWNER
  });

  await ensureA2ImergidosConectadosEvent(tcr.id, tcrAdmin.id);

  await ensureOrganization({
    slug: "a2-imergidos",
    name: "A2 Imergidos",
    publicDomain: "a2imergidos.com.br",
    adminDomain: "produtor.a2imergidos.com.br",
    logoUrl: A2_IMERGIDOS_LOGO_URL,
    primaryColor: "#050505",
    secondaryColor: "#ffffff",
    supportEmail: "contato@a2imergidos.com.br"
  });

  const shieldGuardAdminEmail = process.env.SEED_SHIELDGUARD_ADMIN_EMAIL || "admin@guerraapornografia.com.br";
  const shieldGuard = await ensureOrganization({
    slug: "shieldguard",
    name: "ShieldGuard",
    supportEmail: shieldGuardAdminEmail
  });

  await ensureCompanySettings({
    organizationId: shieldGuard.id,
    companyName: "Guerra a Pornografia Tecnologia Ltda",
    tradeName: "Guerra a Pornografia",
    document: "00.000.000/0001-00",
    supportEmail: shieldGuardAdminEmail,
    platformFeeBps: 1000
  });

  const planSeeds = [
    {
      code: "monthly",
      name: "Plano mensal",
      description: "Ideal para uso individual com renovacao a cada mes.",
      status: PlanStatus.ACTIVE,
      interval: SubscriptionInterval.MONTHLY,
      durationDays: 30,
      priceInCents: 2990,
      trialDays: 7,
      gracePeriodDays: 2,
      maxDevices: 2,
      sortOrder: 10
    },
    {
      code: "quarterly",
      name: "Plano trimestral",
      description: "Reduz churn com ciclo de 90 dias e ate 2 dispositivos.",
      status: PlanStatus.ACTIVE,
      interval: SubscriptionInterval.QUARTERLY,
      durationDays: 90,
      priceInCents: 7990,
      trialDays: 7,
      gracePeriodDays: 2,
      maxDevices: 2,
      sortOrder: 20
    },
    {
      code: "semiannual",
      name: "Plano semestral",
      description: "Maior compromisso com mais estabilidade de receita.",
      status: PlanStatus.ACTIVE,
      interval: SubscriptionInterval.SEMIANNUAL,
      durationDays: 180,
      priceInCents: 14990,
      trialDays: 7,
      gracePeriodDays: 3,
      maxDevices: 3,
      sortOrder: 30
    },
    {
      code: "annual",
      name: "Plano anual",
      description: "Melhor custo-beneficio para uso continuo.",
      status: PlanStatus.ACTIVE,
      interval: SubscriptionInterval.YEARLY,
      durationDays: 365,
      priceInCents: 26990,
      trialDays: 7,
      gracePeriodDays: 3,
      maxDevices: 3,
      sortOrder: 40
    },
    {
      code: "family",
      name: "Plano familia",
      description: "Gerenciamento compartilhado para mais dispositivos e responsabilidade.",
      status: PlanStatus.ACTIVE,
      interval: SubscriptionInterval.FAMILY,
      durationDays: 365,
      priceInCents: 39990,
      trialDays: 7,
      gracePeriodDays: 3,
      maxDevices: 5,
      allowsAccountability: true,
      allowsEmergencyMode: true,
      allowsRecoveryTools: true,
      sortOrder: 50
    }
  ];

  for (const plan of planSeeds) {
    await upsertPlan(plan);
  }

  await upsertDefaultProtectionPolicy();

  console.log("Seed multi-tenant concluido sem remover eventos operacionais.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
