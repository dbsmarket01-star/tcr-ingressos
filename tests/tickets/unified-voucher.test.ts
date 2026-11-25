import { describe, expect, it } from "vitest";
import { buildScheduleLines, buildTicketPdf, buildTicketsPdf } from "@/lib/ticket-pdf";

const input = {
  brandName: "TCR Ingressos",
  brandPrimaryColor: "#006b45",
  eventTitle: "Evento de teste",
  eventDate: new Date("2027-03-20T23:00:00Z"),
  venue: "Teatro Exemplo - Sao Paulo, SP",
  address: "Rua Exemplo, 100",
  buyerName: "Comprador de teste",
  orderCode: "PEDIDO-TESTE",
  ticketCode: "ING-TESTE-001",
  ticketName: "OURO - CADEIRA 12",
  issuedAt: new Date("2026-11-24T12:00:00Z"),
  qrCodeToken: "token-de-teste-sem-validade",
  ticketUrl: "https://tcringressos.com.br/ingresso/ING-TESTE-001",
  scheduleLines: buildScheduleLines("Levar documento; Entrada pelo portao principal")
};

describe("voucher oficial", () => {
  it("mantém QR, setor e observações sem expor dados do comprador no documento", async () => {
    const pdf = await buildTicketPdf(input);
    const content = pdf.toString("latin1");
    expect(content).toContain("/Subtype /Image");
    expect(content).toContain("/Logo Do");
    expect(content).toContain("ING-TESTE-001");
    expect(content).toContain("OURO - CADEIRA 12");
    expect(content).toContain("OBSERVACOES");
    expect(content).toContain("Entrada pelo portao principal");
    expect(content).not.toContain("Comprador de teste");
    expect(content).not.toContain("PEDIDO-TESTE");
  });

  it("usa o mesmo modelo no PDF individual e no PDF do pedido", async () => {
    const single = await buildTicketPdf(input);
    const bundle = await buildTicketsPdf([input]);
    expect(single).toEqual(bundle);
  });
});
