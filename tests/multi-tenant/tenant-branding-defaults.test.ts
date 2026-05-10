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
});
