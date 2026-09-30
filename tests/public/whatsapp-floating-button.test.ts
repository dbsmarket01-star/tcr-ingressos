import { describe, expect, it } from "vitest";
import { buildWhatsappHref } from "@/components/public/WhatsappFloatingButton";

describe("buildWhatsappHref", () => {
  it("adiciona o evento na mensagem inicial do WhatsApp", () => {
    const href = buildWhatsappHref(
      "https://wa.me/5521984456499",
      "Quero tirar uma dúvida no site da TCR Ingressos sobre o evento Guilherme Arantes."
    );

    expect(new URL(href).searchParams.get("text")).toBe(
      "Quero tirar uma dúvida no site da TCR Ingressos sobre o evento Guilherme Arantes."
    );
  });

  it("substitui a mensagem genérica sem alterar o número", () => {
    const href = buildWhatsappHref(
      "https://wa.me/5521984456499?text=Mensagem%20antiga",
      "Mensagem personalizada"
    );
    const url = new URL(href);

    expect(url.pathname).toBe("/5521984456499");
    expect(url.searchParams.get("text")).toBe("Mensagem personalizada");
  });
});
