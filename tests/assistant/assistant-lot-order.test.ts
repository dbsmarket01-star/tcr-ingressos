import { describe, expect, it } from "vitest";
import { isTicketOrderRequest, proposedTicketOrder, resolveTicketOrder } from "@/features/assistant/assistant-lot-order";

const lot = (id: string, name: string, sortOrder: number, priceInCents: number, status = "ACTIVE") =>
  ({ id, name, sortOrder, priceInCents, status });

describe("assistant ticket ordering", () => {
  it("recognizes ordering but not mere price or name changes", () => {
    expect(isTicketOrderRequest("Organize os ingressos: meia, Black November e inteira em cada setor")).toBe(true);
    expect(isTicketOrderRequest("Aumente o preço do ingresso inteira")).toBe(false);
  });

  it("preserves sector sequence and orders category within each sector", () => {
    const rows = [
      lot("pb", "PISTA - BLACK NOVEMBER", 0, 6790), lot("pi", "PISTA - INTEIRA", 1, 19790),
      lot("pm", "PISTA - MEIA ENTRADA", 2, 6790), lot("cb", "CADEIRA - BLACK NOVEMBER", 3, 9790),
      lot("ci", "CADEIRA - INTEIRA", 4, 19790), lot("cm", "CADEIRA - MEIA ENTRADA", 5, 9790),
      lot("ps", "PISTA - SOLIDÁRIO", 6, 6790, "PAUSED")
    ];
    expect(proposedTicketOrder(rows).map((item) => item.id)).toEqual(["pm", "pb", "pi", "cm", "cb", "ci"]);
  });

  it("prioritizes the lowest price within a sector, using category only to break ties", () => {
    const rows = [
      lot("m", "SETOR OURO - MEIA ENTRADA", 0, 20000),
      lot("b", "SETOR OURO - BLACK NOVEMBER", 1, 15000),
      lot("i", "SETOR OURO - INTEIRA", 2, 30000),
      lot("c", "CAMAROTE 18 - COMPARTILHADO", 3, 18000)
    ];
    expect(proposedTicketOrder(rows).map((item) => item.id)).toEqual(["b", "m", "i", "c"]);
  });
});

describe("explicit sector moves",()=>{
 const rows=[lot("p","PISTA - MEIA ENTRADA",0,100),lot("o1","OURO - MEIA ENTRADA",1,200),lot("o2","OURO - INTEIRA",2,400),lot("c18","CAMAROTE 18 - COMPARTILHADO",3,500),lot("f","PRIMEIRA FILEIRA - EXCLUSIVO",4,600),lot("c10","CAMAROTE PARA 10 PESSOAS",5,1000),lot("paused","OURO - SOLIDÁRIO",6,200,"PAUSED")];
 it("moves Primeira Fileira before shared boxes without touching values or paused tickets",()=>{const result=resolveTicketOrder(rows,"No Fernandinho Santo André, coloque Primeira Fileira antes do Camarote 18 Compartilhado");expect(result.error).toBeUndefined();expect(result.lots.map(l=>l.id)).toEqual(["p","o1","o2","f","c18","c10"]);expect(result.lots.find(l=>l.id==="f")).toBe(rows[4]);});
 it("moves an entire sector one position down",()=>{expect(resolveTicketOrder(rows,"Mova o setor Ouro para baixo").lots.map(l=>l.id)).toEqual(["p","c18","o1","o2","f","c10"]);});
 it("moves before every box sector",()=>{expect(resolveTicketOrder(rows,"Coloque Primeira Fileira antes de todos os camarotes").lots.map(l=>l.id)).toEqual(["p","o1","o2","f","c18","c10"]);});
 it("does not mistake the capacity in the exact box name for another sector",()=>{expect(resolveTicketOrder(rows,"Mova Camarote para 10 pessoas antes do Camarote 18").lots.map(l=>l.id)).toEqual(["p","o1","o2","c10","c18","f"]);});
 it("rejects missing destination rather than executing generic sorting",()=>{expect(resolveTicketOrder(rows,"Mova Ouro antes do Bronze").error).toBeTruthy();});
 it("does not intercept price/name changes as sector moves",()=>{expect(isTicketOrderRequest("Coloque o preço de Ouro em R$ 200")).toBe(false);expect(isTicketOrderRequest("Mova Primeira Fileira antes dos camarotes")).toBe(true);});
});
