import { describe, it, expect } from "vitest";
import { selectSupportEvent, guardSupportCatalog } from "@/features/ai/whatsapp-catalog-grounding";
const taubate = { id: "t", title: "Rodrigo Teaser em Taubaté", city: "Taubaté", url: "https://example.test/taubate", tickets: [{ name: "PRATA - BLACK NOVEMBER", basePrice: "R$ 157,90", serviceFee: "R$ 31,58", availableUnits: 10 }, { name: "OURO - INTEIRA", basePrice: "R$ 417,90", serviceFee: "R$ 83,58", availableUnits: 0 }] };
const fernandinho = { ...taubate, id: "f", title: "Fernandinho em Santo André", city: "Santo André" };
const geriatricus = { ...taubate, id: "g", title: "Geriatricus em Santo André", city: "Santo André" };
const events = [taubate, fernandinho, geriatricus];
const decision = (reply: string) => ({ outcome: "AUTO_REPLY" as const, reply, reason: "", topic: "" });
describe("isolamento do catálogo por evento", () => {
  it("seleciona cidade inequívoca em mensagem do cliente, ignorando evento dito pela IA", () => {
    expect(selectSupportEvent("Para 3 pessoas", [{direction:"customer",text:"Rodrigo em Taubaté"}, {direction:"support",text:"Fernandinho em Santo André"}], events)?.id).toBe("t");
  });
  it("reconhece artista e cidade compartilhada por eventos", () => {
    expect(selectSupportEvent("Geriatricus Santo André", [], events)?.id).toBe("g");
  });
  it("não escolhe entre eventos ambíguos nem usa resposta anterior como identificação", () => {
    expect(selectSupportEvent("Santo André", [{direction:"customer",text:taubate.title}], events)).toBeNull();
    expect(selectSupportEvent("Quero ingressos", [{direction:"support",text:taubate.title}], events)).toBeNull();
  });
  it("troca o contexto quando o cliente identifica outro evento", () => {
    expect(selectSupportEvent(geriatricus.title, [{direction:"customer",text:taubate.title}], events)?.id).toBe("g");
  });
  it("não inventa evento para comparação entre cidades", () => {
    expect(selectSupportEvent("Taubaté ou Santo André", [], events)).toBeNull();
  });
  it("substitui pista inexistente por catálogo real e exclui esgotados", () => {
    const result=guardSupportCatalog({decision:decision("Temos Pista por R$ 165,48 e camarotes."),event:taubate,customerMessage:"E para 3 pessoas?",hasOrders:false});
    expect(result.reply).toContain("PRATA - BLACK NOVEMBER: R$ 157,90 + R$ 31,58");
    expect(result.reply).not.toMatch(/Pista|165,48|OURO - INTEIRA|camarotes/);
  });
  it("não aceita preço inventado mesmo se o nome do setor está correto", () => {
    const result=guardSupportCatalog({decision:decision("Prata por R$ 999,00."),event:taubate,customerMessage:"Sim",hasOrders:false});
    expect(result.reply).not.toContain("999,00"); expect(result.reply).toContain("157,90");
  });
  it("pede evento antes de informar catálogo sem identificação segura", () => {
    expect(guardSupportCatalog({decision:decision("Temos pista e camarotes"),event:null,customerMessage:"Ingressos",hasOrders:false}).topic).toBe("identificar_evento");
  });
  it("mantém dúvida genérica e encaminhamento humano", () => {
    const d=decision("Aceitamos Pix e cartão.");
    expect(guardSupportCatalog({decision:d,event:null,customerMessage:"Formas de pagamento?",hasOrders:false})).toEqual(d);
    const h={...d,outcome:"HANDOFF" as const}; expect(guardSupportCatalog({decision:h,event:taubate,customerMessage:"Ajuda",hasOrders:false})).toEqual(h);
  });
});
