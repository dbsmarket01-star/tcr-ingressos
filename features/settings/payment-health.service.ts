import { ensureDefaultOrganizationBackfill } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";

function hasValue(value?: string) {
  return Boolean(value && value.trim().length > 0);
}

function maskToken(value?: string) {
  if (!value) {
    return null;
  }

  const visibleEnd = value.slice(-4);
  return `Configurada com final ${visibleEnd}`;
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function getAsaasEnvironment(apiUrl?: string) {
  if (!apiUrl) {
    return "Sandbox";
  }

  return apiUrl.includes("api.asaas.com") ? "Producao" : "Sandbox";
}

function getHostingProvider() {
  return process.env.HOSTING_PROVIDER || (process.env.VERCEL ? "VERCEL" : "LOCAL");
}

function getHostingPlan() {
  return process.env.HOSTING_PLAN || "Nao informado";
}

function getDatabaseProvider() {
  return process.env.DATABASE_PROVIDER || "SUPABASE";
}

function getDatabasePlan() {
  return process.env.DATABASE_PLAN || "Nao informado";
}

function isLocalUrl(value: string) {
  return value.includes("localhost") || value.includes("127.0.0.1");
}

export async function getPaymentHealth() {
  const organizationId = await ensureDefaultOrganizationBackfill();
  const appUrl = getAppUrl();
  const provider = process.env.PAYMENT_PROVIDER || "SIMULATED";
  const asaasApiUrl = process.env.ASAAS_API_URL || "https://api-sandbox.asaas.com/v3";
  const [recentPayments, dbSplitRules] = await Promise.all([
    prisma.payment.groupBy({
      by: ["provider", "status"],
      _count: {
        _all: true
      }
    }),
    prisma.paymentSplitRule.findMany({
      where: {
        organizationId,
        isActive: true
      }
    })
  ]);
  const envSplitWalletsConfigured = Array.from({ length: 10 }).filter((_, index) =>
    hasValue(process.env[`ASAAS_SPLIT_WALLET_ID_${index + 1}`])
  ).length;
  const envSplitRulesConfigured = Array.from({ length: 10 }).filter((_, index) =>
    hasValue(process.env[`ASAAS_SPLIT_PERCENTUAL_VALUE_${index + 1}`]) ||
    hasValue(process.env[`ASAAS_SPLIT_FIXED_VALUE_${index + 1}`])
  ).length;

  return {
    provider,
    appUrl,
    asaas: {
      enabled: provider === "ASAAS",
      apiKeyConfigured: hasValue(process.env.ASAAS_API_KEY),
      apiKeyMasked: maskToken(process.env.ASAAS_API_KEY),
      apiUrl: asaasApiUrl,
      environment: getAsaasEnvironment(asaasApiUrl),
      billingType: process.env.ASAAS_BILLING_TYPE || "PIX",
      webhookTokenConfigured: hasValue(process.env.ASAAS_WEBHOOK_TOKEN),
      webhookUrl: `${appUrl}/api/webhooks/payments/asaas`,
      splitEnabled: process.env.ASAAS_SPLIT_ENABLED === "true" || dbSplitRules.length > 0,
      splitWalletsConfigured: dbSplitRules.length || envSplitWalletsConfigured,
      splitRulesConfigured: dbSplitRules.length || envSplitRulesConfigured
    },
    database: {
      provider: getDatabaseProvider(),
      plan: getDatabasePlan(),
      databaseUrlConfigured: hasValue(process.env.DATABASE_URL),
      directUrlConfigured: hasValue(process.env.DIRECT_URL),
      usesPooling:
        hasValue(process.env.DATABASE_URL) &&
        process.env.DATABASE_URL!.includes("pgbouncer=true") &&
        process.env.DATABASE_URL!.includes("connection_limit=")
    },
    uploads: {
      provider: process.env.UPLOAD_STORAGE_PROVIDER || "LOCAL",
      localPersistent:
        process.env.UPLOAD_STORAGE_PROVIDER === "LOCAL_PERSISTENT" ||
        process.env.UPLOAD_STORAGE_PERSISTENT === "true",
      maxImageMb: Number(process.env.UPLOAD_MAX_IMAGE_MB || 10),
      supabaseUrlConfigured: hasValue(process.env.SUPABASE_URL),
      supabaseServiceRoleConfigured: hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
      supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || "event-media"
    },
    google: {
      clientIdConfigured: hasValue(process.env.GOOGLE_CLIENT_ID),
      clientSecretConfigured: hasValue(process.env.GOOGLE_CLIENT_SECRET)
    },
    mercadoPago: {
      enabled: provider === "MERCADO_PAGO",
      accessTokenConfigured: hasValue(process.env.MERCADO_PAGO_ACCESS_TOKEN),
      webhookSecretConfigured: hasValue(process.env.MERCADO_PAGO_WEBHOOK_SECRET),
      webhookUrl: `${appUrl}/api/webhooks/payments/mercado-pago`
    },
    email: {
      resendConfigured: hasValue(process.env.RESEND_API_KEY),
      from: process.env.EMAIL_FROM || "TCR Ingressos <ingressos@tcringressos.com.br>"
    },
    security: {
      authSecretConfigured: hasValue(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
      adminHostConfigured: hasValue(process.env.ADMIN_HOST),
      cronSecretConfigured: hasValue(process.env.CRON_SECRET),
      productionCronProtected: process.env.NODE_ENV === "production" ? hasValue(process.env.CRON_SECRET) : true,
      nodeEnv: process.env.NODE_ENV || "development",
      vercelEnv: process.env.VERCEL_ENV || null,
      hostingProvider: getHostingProvider(),
      hostingPlan: getHostingPlan(),
      region: process.env.VERCEL_REGION || process.env.AWS_REGION || null,
      appUrlIsLocal: isLocalUrl(appUrl),
      appUrlUsesHttps: appUrl.startsWith("https://")
    },
    recentPayments: recentPayments.map((item) => ({
      provider: item.provider,
      status: item.status,
      count: item._count._all
    }))
  };
}
