import {
  getDefaultOrganizationId,
  getOrganizationBrandingById
} from "@/features/organizations/organization.service";
import {
  canUseGlobalPaymentEnv,
  getAsaasHealthConfigForOrganization,
  getPaymentProviderNameForOrganization
} from "@/features/payments/payment-organization-config";
import { prisma } from "@/lib/prisma";

function hasValue(value?: string) {
  return Boolean(value && value.trim().length > 0);
}

function getAppUrl(organization?: { publicDomain?: string | null } | null) {
  if (organization?.publicDomain) {
    const publicDomain = organization.publicDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const protocol = publicDomain.includes("localhost") || publicDomain.startsWith("127.0.0.1") ? "http" : "https";

    return `${protocol}://${publicDomain}`;
  }

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

export async function getPaymentHealth(organizationId?: string) {
  const resolvedOrganizationId = organizationId || (await getDefaultOrganizationId());
  const organization = await getOrganizationBrandingById(resolvedOrganizationId);
  const appUrl = getAppUrl(organization);
  const provider = getPaymentProviderNameForOrganization(organization);
  const asaas = getAsaasHealthConfigForOrganization(organization);
  const asaasApiUrl = asaas.apiUrl;
  const includeGlobalSplitEnv = canUseGlobalPaymentEnv(organization);
  const [recentPayments, dbSplitRules] = await Promise.all([
    prisma.payment.groupBy({
      by: ["provider", "status"],
      where: {
        order: {
          event: {
            organizationId: resolvedOrganizationId
          }
        }
      },
      _count: {
        _all: true
      }
    }),
    prisma.paymentSplitRule.findMany({
      where: {
        organizationId: resolvedOrganizationId,
        isActive: true
      }
    })
  ]);
  const envSplitWalletsConfigured = includeGlobalSplitEnv
    ? Array.from({ length: 10 }).filter((_, index) =>
        hasValue(process.env[`ASAAS_SPLIT_WALLET_ID_${index + 1}`])
      ).length
    : 0;
  const envSplitRulesConfigured = includeGlobalSplitEnv
    ? Array.from({ length: 10 }).filter((_, index) =>
        hasValue(process.env[`ASAAS_SPLIT_PERCENTUAL_VALUE_${index + 1}`]) ||
        hasValue(process.env[`ASAAS_SPLIT_FIXED_VALUE_${index + 1}`])
      ).length
    : 0;

  return {
    provider,
    appUrl,
    organization: organization
      ? {
          id: organization.id,
          slug: organization.slug,
          name: organization.name,
          publicDomain: organization.publicDomain
        }
      : null,
    asaas: {
      enabled: provider === "ASAAS",
      organizationEnvSuffix: asaas.organizationEnvSuffix,
      apiKeyConfigured: asaas.apiKeyConfigured,
      apiKeyMasked: asaas.apiKeyMasked,
      apiKeyEnvName: asaas.apiKeyEnvName,
      apiUrl: asaasApiUrl,
      apiUrlEnvName: asaas.apiUrlEnvName,
      environment: getAsaasEnvironment(asaasApiUrl),
      billingType: asaas.billingType,
      billingTypeEnvName: asaas.billingTypeEnvName,
      webhookTokenConfigured: asaas.webhookTokenConfigured,
      webhookTokenEnvName: asaas.webhookTokenEnvName,
      webhookUrl: `${appUrl}/api/webhooks/payments/asaas`,
      splitEnabled: (includeGlobalSplitEnv && process.env.ASAAS_SPLIT_ENABLED === "true") || dbSplitRules.length > 0,
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
      from:
        process.env.EMAIL_FROM ||
        `${process.env.DEFAULT_EMAIL_BRAND || "Ingresaas"} <${process.env.DEFAULT_EMAIL_FROM_ADDRESS || "ingressos@ingresaas.app.br"}>`
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
