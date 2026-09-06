import { afterEach, describe, expect, it, vi } from "vitest";
import { getAsaasConfigForOrganization } from "@/features/payments/payment-organization-config";

describe("payment organization config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves the A2 Imergidos scoped Asaas config without using the global key", () => {
    vi.stubEnv("ASAAS_API_KEY_A2_IMERGIDOS", "a2-secret-key");
    vi.stubEnv("ASAAS_API_URL_A2_IMERGIDOS", "https://api.asaas.com/v3/");
    vi.stubEnv("ASAAS_BILLING_TYPE_A2_IMERGIDOS", "PIX");
    vi.stubEnv("ASAAS_API_KEY", "global-secret-key");

    const config = getAsaasConfigForOrganization({
      slug: "a2-imergidos",
      name: "A2 Imergidos"
    });

    expect(config.accessToken).toBe("a2-secret-key");
    expect(config.apiKeyEnvName).toBe("ASAAS_API_KEY_A2_IMERGIDOS");
    expect(config.apiUrl).toBe("https://api.asaas.com/v3");
    expect(config.billingType).toBe("PIX");
    expect(config.organizationEnvSuffix).toBe("A2_IMERGIDOS");
    expect(config.allowGlobalAsaasSplit).toBe(false);
  });

  it("does not fall back to the global Asaas API key for unknown non-default bilheterias", () => {
    vi.stubEnv("ASAAS_API_KEY_ELO_CONFERENCE_GLOBAL", "");
    vi.stubEnv("ASAAS_API_KEY", "global-secret-key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://tcringressos.app.br");
    vi.stubEnv("APP_URL", "https://tcringressos.app.br");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "tcringressos.app.br");
    vi.stubEnv("VERCEL_URL", "tcr-ingressos.vercel.app");

    expect(() =>
      getAsaasConfigForOrganization({
        slug: "elo-conference-global",
        name: "ELO Conference Global"
      })
    ).toThrow("ASAAS_API_KEY_ELO_CONFERENCE_GLOBAL nao configurada para a bilheteria ELO Conference Global.");
  });

  it("allows the A2 project global Asaas API key when the scoped key is missing", () => {
    vi.stubEnv("ASAAS_API_KEY_A2_IMERGIDOS", "");
    vi.stubEnv("ASAAS_API_URL_A2_IMERGIDOS", "");
    vi.stubEnv("ASAAS_BILLING_TYPE_A2_IMERGIDOS", "");
    vi.stubEnv("ASAAS_API_KEY", "a2-project-global-key");
    vi.stubEnv("ASAAS_API_URL", "https://api.asaas.com/v3");
    vi.stubEnv("ASAAS_BILLING_TYPE", "PIX");

    const config = getAsaasConfigForOrganization({
      slug: "a2-imergidos",
      name: "A2 Imergidos"
    });

    expect(config.accessToken).toBe("a2-project-global-key");
    expect(config.apiKeyEnvName).toBe("ASAAS_API_KEY");
    expect(config.allowGlobalAsaasSplit).toBe(false);
    expect(config.organizationEnvSuffix).toBe("A2_IMERGIDOS");
  });
});
