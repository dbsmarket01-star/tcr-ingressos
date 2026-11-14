import { describe, expect, it } from "vitest";
import { getSiteEventWhatsappMessage } from "@/features/whatsapp/site-prefilled-message";

describe("mensagem inicial do WhatsApp por bilheteria", () => {
  it("identifica o site A2 e mantém o nome do evento", () => {
    expect(getSiteEventWhatsappMessage("a2-imergidos", "A2 Imergidos Gramado 2027"))
      .toBe("Olá, vim do site do A2 e quero tirar uma dúvida sobre o evento A2 Imergidos Gramado 2027.");
  });

  it("preserva a mensagem atual da TCR", () => {
    expect(getSiteEventWhatsappMessage("tcr-ingressos", "Rodrigo Teaser em Sorocaba"))
      .toBe("Quero tirar uma dúvida no site da TCR Ingressos sobre o evento Rodrigo Teaser em Sorocaba.");
  });
});
