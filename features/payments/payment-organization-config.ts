import { DEFAULT_ORGANIZATION_SLUG } from "@/features/organizations/organization.service";

export type PaymentOrganizationContext = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
};

export type ScopedEnvValue = {
  value: string | undefined;
  envName: string;
  scoped: boolean;
};

export type AsaasOrganizationConfig = {
  accessToken: string;
  apiKeyEnvName: string;
  apiUrl: string;
  apiUrlEnvName: string;
  billingType: string;
  billingTypeEnvName: string;
  allowGlobalAsaasSplit: boolean;
  organizationEnvSuffix: string | null;
};

function hasValue(value?: string | null): value is string {
  return Boolean(value && value.trim().length > 0);
}

export function maskToken(value?: string | null) {
  if (!value) {
    return null;
  }

  const visibleEnd = value.slice(-4);
  return `Configurada com final ${visibleEnd}`;
}

export function getPaymentOrganizationEnvSuffix(organization?: PaymentOrganizationContext | null) {
  const source = organization?.slug || organization?.id;

  if (!source) {
    return null;
  }

  const suffix = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return suffix || null;
}

export function canUseGlobalPaymentEnv(organization?: PaymentOrganizationContext | null) {
  return !organization?.slug || organization.slug === DEFAULT_ORGANIZATION_SLUG;
}

function getKnownScopedPaymentEnv(baseName: string, suffix: string | null) {
  if (!suffix) {
    return undefined;
  }

  const knownValues: Record<string, Record<string, string | undefined>> = {
    A2_IMERGIDOS: {
      PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER_A2_IMERGIDOS,
      ASAAS_API_KEY: process.env.ASAAS_API_KEY_A2_IMERGIDOS,
      ASAAS_API_URL: process.env.ASAAS_API_URL_A2_IMERGIDOS,
      ASAAS_BILLING_TYPE: process.env.ASAAS_BILLING_TYPE_A2_IMERGIDOS,
      ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN_A2_IMERGIDOS
    },
    TCR_INGRESSOS: {
      PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER_TCR_INGRESSOS,
      ASAAS_API_KEY: process.env.ASAAS_API_KEY_TCR_INGRESSOS,
      ASAAS_API_URL: process.env.ASAAS_API_URL_TCR_INGRESSOS,
      ASAAS_BILLING_TYPE: process.env.ASAAS_BILLING_TYPE_TCR_INGRESSOS,
      ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN_TCR_INGRESSOS
    },
    ELO_CONFERENCE_GLOBAL: {
      PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER_ELO_CONFERENCE_GLOBAL,
      ASAAS_API_KEY: process.env.ASAAS_API_KEY_ELO_CONFERENCE_GLOBAL,
      ASAAS_API_URL: process.env.ASAAS_API_URL_ELO_CONFERENCE_GLOBAL,
      ASAAS_BILLING_TYPE: process.env.ASAAS_BILLING_TYPE_ELO_CONFERENCE_GLOBAL,
      ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN_ELO_CONFERENCE_GLOBAL
    }
  };

  return knownValues[suffix]?.[baseName];
}

export function getScopedPaymentEnv(
  baseName: string,
  organization?: PaymentOrganizationContext | null,
  options?: {
    allowGlobalFallback?: boolean;
    defaultValue?: string;
  }
): ScopedEnvValue {
  const suffix = getPaymentOrganizationEnvSuffix(organization);
  const scopedName = suffix ? `${baseName}_${suffix}` : baseName;
  const scopedValue = suffix ? getKnownScopedPaymentEnv(baseName, suffix) ?? process.env[scopedName] : undefined;

  if (hasValue(scopedValue)) {
    return {
      value: scopedValue.trim(),
      envName: scopedName,
      scoped: true
    };
  }

  const allowGlobalFallback = options?.allowGlobalFallback ?? canUseGlobalPaymentEnv(organization);
  const globalValue = allowGlobalFallback ? process.env[baseName] : undefined;

  if (hasValue(globalValue)) {
    return {
      value: globalValue.trim(),
      envName: baseName,
      scoped: false
    };
  }

  return {
    value: options?.defaultValue,
    envName: scopedName,
    scoped: Boolean(suffix)
  };
}

export function getPaymentProviderNameForOrganization(organization?: PaymentOrganizationContext | null) {
  const provider = getScopedPaymentEnv("PAYMENT_PROVIDER", organization, {
    allowGlobalFallback: true,
    defaultValue: "SIMULATED"
  });

  return (provider.value || "SIMULATED").toUpperCase();
}

export function getAsaasConfigForOrganization(organization?: PaymentOrganizationContext | null): AsaasOrganizationConfig {
  const allowGlobalApiKey = canUseGlobalPaymentEnv(organization);
  const apiKey = getScopedPaymentEnv("ASAAS_API_KEY", organization, {
    allowGlobalFallback: allowGlobalApiKey
  });

  if (!apiKey.value) {
    const operationName = organization?.name || organization?.slug || "operacao";
    throw new Error(`${apiKey.envName} nao configurada para a bilheteria ${operationName}.`);
  }

  const apiUrl = getScopedPaymentEnv("ASAAS_API_URL", organization, {
    allowGlobalFallback: true,
    defaultValue: "https://api-sandbox.asaas.com/v3"
  });
  const billingType = getScopedPaymentEnv("ASAAS_BILLING_TYPE", organization, {
    allowGlobalFallback: true,
    defaultValue: "PIX"
  });

  return {
    accessToken: apiKey.value,
    apiKeyEnvName: apiKey.envName,
    apiUrl: (apiUrl.value || "https://api-sandbox.asaas.com/v3").replace(/\/$/, ""),
    apiUrlEnvName: apiUrl.envName,
    billingType: billingType.value || "PIX",
    billingTypeEnvName: billingType.envName,
    allowGlobalAsaasSplit: allowGlobalApiKey,
    organizationEnvSuffix: getPaymentOrganizationEnvSuffix(organization)
  };
}

export function getAsaasWebhookTokenForOrganization(organization?: PaymentOrganizationContext | null) {
  return getScopedPaymentEnv("ASAAS_WEBHOOK_TOKEN", organization, {
    allowGlobalFallback: canUseGlobalPaymentEnv(organization)
  });
}

export function getAsaasHealthConfigForOrganization(organization?: PaymentOrganizationContext | null) {
  const allowGlobalApiKey = canUseGlobalPaymentEnv(organization);
  const apiKey = getScopedPaymentEnv("ASAAS_API_KEY", organization, {
    allowGlobalFallback: allowGlobalApiKey
  });
  const apiUrl = getScopedPaymentEnv("ASAAS_API_URL", organization, {
    allowGlobalFallback: true,
    defaultValue: "https://api-sandbox.asaas.com/v3"
  });
  const billingType = getScopedPaymentEnv("ASAAS_BILLING_TYPE", organization, {
    allowGlobalFallback: true,
    defaultValue: "PIX"
  });
  const webhookToken = getAsaasWebhookTokenForOrganization(organization);

  return {
    organizationEnvSuffix: getPaymentOrganizationEnvSuffix(organization),
    apiKeyConfigured: Boolean(apiKey.value),
    apiKeyMasked: maskToken(apiKey.value),
    apiKeyEnvName: apiKey.envName,
    apiUrl: apiUrl.value || "https://api-sandbox.asaas.com/v3",
    apiUrlEnvName: apiUrl.envName,
    billingType: billingType.value || "PIX",
    billingTypeEnvName: billingType.envName,
    webhookTokenConfigured: Boolean(webhookToken.value),
    webhookTokenEnvName: webhookToken.envName
  };
}
