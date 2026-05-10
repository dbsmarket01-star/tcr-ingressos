import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  organization: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn()
  }
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: Array<string>) => unknown) => fn
}));

describe("organization context by host", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_DOMAIN = "ingresaas.app.br";
  });

  it("matches public host with and without www as the same tenant", async () => {
    const a2Organization = {
      id: "org_a2",
      slug: "a2-imergidos",
      name: "A2 Imergidos",
      publicDomain: "a2imergidos.com.br",
      adminDomain: "produtor.a2imergidos.com.br",
      logoUrl: null,
      primaryColor: "#0b57d0",
      secondaryColor: "#ffffff",
      supportEmail: "contato@a2imergidos.com.br",
      supportPhone: null,
      isActive: true
    };

    prismaMock.organization.findFirst.mockResolvedValue(a2Organization);

    const { getOrganizationContextByHost } = await import("@/features/organizations/organization.service");

    const context = await getOrganizationContextByHost("www.a2imergidos.com.br");

    expect(prismaMock.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          OR: [
            { publicDomain: { in: ["www.a2imergidos.com.br", "a2imergidos.com.br"] } },
            { adminDomain: { in: ["www.a2imergidos.com.br", "a2imergidos.com.br"] } }
          ]
        },
        select: expect.any(Object)
      })
    );
    expect(context.organization.id).toBe("org_a2");
    expect(context.isMatchedByHost).toBe(true);
    expect(context.isAdminHost).toBe(false);
    expect(context.brandName).toBe("A2 Imergidos");
    expect(context.publicBaseUrl).toBe("https://a2imergidos.com.br");
  });

  it("marks admin host correctly for the matched tenant", async () => {
    const a2Organization = {
      id: "org_a2",
      slug: "a2-imergidos",
      name: "A2 Imergidos",
      publicDomain: "a2imergidos.com.br",
      adminDomain: "produtor.a2imergidos.com.br",
      logoUrl: null,
      primaryColor: "#0b57d0",
      secondaryColor: "#ffffff",
      supportEmail: "contato@a2imergidos.com.br",
      supportPhone: null,
      isActive: true
    };

    prismaMock.organization.findFirst.mockResolvedValue(a2Organization);

    const { getOrganizationContextByHost } = await import("@/features/organizations/organization.service");

    const context = await getOrganizationContextByHost("produtor.a2imergidos.com.br");

    expect(context.organization.id).toBe("org_a2");
    expect(context.isMatchedByHost).toBe(true);
    expect(context.isAdminHost).toBe(true);
    expect(context.adminBaseUrl).toBe("https://produtor.a2imergidos.com.br");
  });

  it("falls back to the default organization when the host does not belong to a child tenant", async () => {
    prismaMock.organization.findFirst.mockResolvedValue(null);
    prismaMock.organization.upsert.mockResolvedValue({
      id: "org_tcr",
      slug: "tcr-ingressos",
      name: "TCR Ingressos",
      publicDomain: "tcringressos.app.br",
      adminDomain: "produtor.tcringressos.app.br",
      supportEmail: null,
      supportPhone: null,
      logoUrl: null,
      primaryColor: "#0d5c63",
      secondaryColor: "#ffffff",
      isActive: true
    });

    const { getOrganizationContextByHost } = await import("@/features/organizations/organization.service");

    const context = await getOrganizationContextByHost("host-desconhecido.com.br");

    expect(context.organization.slug).toBe("tcr-ingressos");
    expect(context.isMatchedByHost).toBe(false);
    expect(context.requestHost).toBe("host-desconhecido.com.br");
  });

  it("throws when an explicit organization context is requested for an unknown tenant", async () => {
    prismaMock.organization.findUnique.mockResolvedValue(null);

    const { getOrganizationContextById } = await import("@/features/organizations/organization.service");

    await expect(getOrganizationContextById("org_inexistente")).rejects.toThrow(
      "Organização não encontrada para o contexto solicitado."
    );
  });
});
