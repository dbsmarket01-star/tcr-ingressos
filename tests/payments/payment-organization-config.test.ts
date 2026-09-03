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

  it("does not fall back to the global Asaas API key for non-default bilheterias", () => {
    vi.stubEnv("ASAAS_API_KEY_A2_IMERGIDOS", "");
    vi.stubEnv("ASAAS_API_KEY", "global-secret-key");

    expect(() =>
      getAsaasConfigForOrganization({
        slug: "a2-imergidos",
        name: "A2 Imergidos"
      })
    ).toThrow("ASAAS_API_KEY_A2_IMERGIDOS nao configurada para a bilheteria A2 Imergidos.");
  });
});
