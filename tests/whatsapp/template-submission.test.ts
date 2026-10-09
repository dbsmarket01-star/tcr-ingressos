import { describe, expect, it } from "vitest";
import { templateSubmissionPayload } from "../../features/whatsapp/campaigns/meta";

const body = `🎹 *GUILHERME ARANTES – 50 ANOS | LUZ*

Uma noite especial está chegando para celebrar 50 anos de música, histórias e grandes sucessos de Guilherme Arantes! ❤️

Prepare-se para cantar, se emocionar e reviver ao vivo músicas que marcaram gerações.

📅 *07 DE NOVEMBRO*
📍 *ESPAÇO LIV MUSIC – SÃO CAETANO DO SUL/SP*

🎟️ Os ingressos estão disponíveis!

Garanta sua participação e venha viver essa experiência inesquecível!

Instagram oficial: @tcrshows.eventos`;

describe("Meta template submission", () => {
  it("preserves the exact approved copy and official sales CTA", () => {
    expect(
      templateSubmissionPayload({
        name: "guilherme_arantes_50_anos_luz",
        language: "pt_BR",
        category: "MARKETING",
        body,
        buttonText: "Comprar ingressos",
        buttonUrl:
          "https://www.tcringressos.app.br/evento/guilherme-arantes-sao-caetano-do-sul?utm_source=whatsapp&utm_medium=message&utm_campaign=guilherme_arantes_50_anos_luz&utm_content=cta_comprar_ingressos",
      }),
    ).toEqual({
      name: "guilherme_arantes_50_anos_luz",
      language: "pt_BR",
      category: "MARKETING",
      components: [
        { type: "BODY", text: body },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: "Comprar ingressos",
              url: "https://www.tcringressos.app.br/evento/guilherme-arantes-sao-caetano-do-sul?utm_source=whatsapp&utm_medium=message&utm_campaign=guilherme_arantes_50_anos_luz&utm_content=cta_comprar_ingressos",
            },
          ],
        },
      ],
    });
  });

  it("rejects a CTA outside the official event sales domain", () => {
    expect(() =>
      templateSubmissionPayload({
        name: "guilherme_arantes_50_anos_luz",
        language: "pt_BR",
        category: "MARKETING",
        body,
        buttonText: "Comprar ingressos",
        buttonUrl: "https://example.com/evento/guilherme-arantes",
      }),
    ).toThrow("link oficial");
  });

  it("accepts the official per-recipient click tracker", () => {
    const result = templateSubmissionPayload({
      name: "guilherme_arantes_50_anos_luz_v2",
      language: "pt_BR",
      category: "MARKETING",
      body,
      buttonText: "Comprar ingressos",
      buttonUrl: "https://www.tcringressos.app.br/r/whatsapp/{{1}}",
    });

    expect((result.components[1] as any).buttons[0].url).toBe(
      "https://www.tcringressos.app.br/r/whatsapp/{{1}}",
    );
  });
});
