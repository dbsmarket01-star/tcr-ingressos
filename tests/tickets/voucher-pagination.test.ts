import { describe, expect, it } from "vitest";
import { buildScheduleLines, buildTicketsPdf, type TicketPdfInput } from "@/lib/ticket-pdf";

export const fixture: TicketPdfInput = {
  brandName: "TCR Ingressos", eventTitle: "Evento sintetico", eventDate: new Date("2027-03-20T23:00:00Z"),
  venue: "Teatro Exemplo", address: "Rua Exemplo, 100", buyerName: "Privado", orderCode: "Pedido privado",
  ticketCode: "AMOSTRA-NAO-VALIDA-001", ticketName: "OURO - MESA 17", issuedAt: new Date(),
  qrCodeToken: "SYNTHETIC-VOUCHER-001-NOT-VALID", ticketUrl: "https://example.invalid", scheduleLines: []
};

describe("voucher pagination", () => {
  it("preserves observations beyond ten lines and three wrapped lines per item", async () => {
    const observations = Array.from({length: 65}, (_, i) => `OBSERVACAO-${i + 1}: levar documento`).join(";");
    const lines = buildScheduleLines(observations + ";" + "Informacao importante ".repeat(30) + "FIM-DAS-REGRAS");
    expect(lines.length).toBeGreaterThan(65);
    const content = (await buildTicketsPdf([{...fixture, scheduleLines: lines}])).toString("latin1");
    for (let i = 1; i <= 65; i++) expect(content).toContain(`OBSERVACAO-${i}:`);
    expect(content).toContain("FIM-DAS-REGRAS");
    expect(content.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(2);
    expect(content).toContain("INFORMACOES COMPLEMENTARES");
  });

  it("keeps long event, venue, address and numbered option with the correct ticket in a bundle", async () => {
    const first = {...fixture,
      eventTitle: "Titulo extenso ".repeat(12) + "FIM-EVENTO",
      venue: "Nome completo do espaco ".repeat(10) + "FIM-LOCAL",
      address: "Endereco extenso ".repeat(15) + "FIM-ENDERECO",
      ticketName: "Camarote especial ".repeat(15) + "CAMAROTE-19-FINAL"
    };
    const content = (await buildTicketsPdf([first, {...fixture, ticketCode: "AMOSTRA-002", ticketName:"PRATA"}])).toString("latin1");
    for (const ending of ["FIM-EVENTO", "FIM-LOCAL", "FIM-ENDERECO", "CAMAROTE-19-FINAL"]) {
      expect(content).toContain(ending);
      expect(content.indexOf(ending)).toBeLessThan(content.indexOf("AMOSTRA-002"));
    }
    expect(content).not.toContain("Privado");
  });

  it.each(["A2 Imergidos", "Elo Conference", "Outra Organizacao"])("preserves tenant branding for %s", async (brandName) => {
    const content = (await buildTicketsPdf([{...fixture, brandName, brandPrimaryColor:"#123456"}])).toString("latin1");
    expect(content).not.toContain("/Logo Do");
    expect(content).toContain("0.071 0.204 0.337");
    expect(content).toContain("20/03/2027, 20:00");
  });
});
