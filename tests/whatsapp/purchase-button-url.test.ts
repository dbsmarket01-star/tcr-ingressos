import { describe, expect, it } from "vitest";
import { isOfficialWhatsAppPurchaseUrl } from "@/features/whatsapp/whatsapp.service";

describe("links de compra no botão do WhatsApp", () => {
  const base = "https://www.tcringressos.app.br/evento/rodrigo-teaser-em-sorocaba-2026";

  it("aceita o seletor de quantidade e o checkout no domínio oficial", () => {
    expect(isOfficialWhatsAppPurchaseUrl(`${base}/quantidade?lotId=cmvn26sqr00011yesrl2ed9jx`)).toBe(true);
    expect(isOfficialWhatsAppPurchaseUrl(`${base}/checkout?lotId=cmvn26sqr00011yesrl2ed9jx`)).toBe(true);
  });

  it("recusa outros domínios e caminhos", () => {
    expect(isOfficialWhatsAppPurchaseUrl("https://www.tcringressos.app.br.evil.example/evento/x/quantidade")).toBe(false);
    expect(isOfficialWhatsAppPurchaseUrl("http://www.tcringressos.app.br/evento/x/quantidade")).toBe(false);
    expect(isOfficialWhatsAppPurchaseUrl(`${base}/outro`)).toBe(false);
  });
});
