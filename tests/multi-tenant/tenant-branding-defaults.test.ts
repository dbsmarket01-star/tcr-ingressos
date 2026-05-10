import { beforeEach, describe, expect, it } from "vitest";

describe("tenant branding defaults", () => {
  beforeEach(() => {
    delete process.env.EMAIL_FROM;
    delete process.env.DEFAULT_EMAIL_BRAND;
    delete process.env.DEFAULT_EMAIL_FROM_ADDRESS;
  });

  it("uses child tenant brand and neutral fallback sender in campaign emails", async () => {
    const { createLeadBroadcastEmailPayload } = await import("@/features/email/email.service");

    const payload = createLeadBroadcastEmailPayload({
      to: "comprador@example.com",
      name: "Comprador",
      subject: "Novidade do evento",
      body: "Seu acesso antecipado foi liberado.",
      brandName: "A2 Imergidos",
      eventTitle: "A2 Imergidos + Conectados"
    });

    expect(payload.from).toBe("A2 Imergidos <ingressos@ingresaas.app.br>");
    expect(payload.html).toContain("A2 Imergidos");
    expect(payload.html).not.toContain("TCR Ingressos");
    expect(payload.from).not.toContain("tcringressos.app.br");
  });

  it("uses A2 visual accent in campaign email assets", async () => {
    const { createLeadBroadcastEmailPayload } = await import("@/features/email/email.service");

    const payload = createLeadBroadcastEmailPayload({
      to: "comprador@example.com",
      name: "Comprador",
      subject: "A2 no ar",
      body: "Confira as novidades do evento.",
      brandName: "A2 Imergidos",
      publicBaseUrl: "https://a2imergidos.com.br",
      imageUrl: "https://cdn.example.com/banner.jpg",
      imageWidth: 1200,
      imageHeight: 630,
      eventTitle: "A2 Imergidos + Conectados",
      ctaLabel: "Ver evento",
      ctaUrl: "https://a2imergidos.com.br/evento/a2-imergidos-conectados"
    });

    expect(payload.html).toContain("#1f5fbf");
    expect(payload.html).toContain("#123c7c");
    expect(payload.html).toContain("accent=%231f5fbf");
    expect(payload.html).toContain("/brands/a2-imergidos-logo.svg");
    expect(payload.html).not.toContain("#08251d");
    expect(payload.html).not.toContain("#14924f");
  });
});
