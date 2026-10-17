import { describe, it, expect, vi } from "vitest";
import { orderTicketLots, orderTicketOptions } from "@/features/lots/lot-order";
import { lockEventLotOrder, normalizeEventLotOrder } from "@/features/lots/lot-order.service";
const lot = (id: string, name: string, sortOrder: number) => ({ id, name, sortOrder });
describe("automatic ticket order", () => {
  it("keeps newly inserted whole-price categories in their sector despite duplicate positions", () => {
    const rows = [lot('a','BRONZE - MEIA',0), lot('b','PRATA - MEIA',1), lot('c','BRONZE - INTEIRA',1), lot('d','PRIMEIRA FILEIRA',2),lot('e','PRATA - INTEIRA',3)];
    expect(orderTicketLots(rows).map(x=>x.id)).toEqual(['a','c','b','e','d']);
    expect(rows.map(x=>x.id)).toEqual(['a','b','c','d','e']);
    expect(orderTicketLots(orderTicketLots(rows))).toEqual(orderTicketLots(rows));
  });
  it("preserves custom sector sequence and groups accented categories and doubles", () => {
    expect(orderTicketLots([lot('a','PISTA - SOLIDÁRIO',0),lot('b','SETOR VIP - PCD',1),lot('c','PISTA DUPLO - MEIA ENTRADA',2)]).map(x=>x.id)).toEqual(['a','c','b']);
  });
  it("orders numbered options naturally without renaming or changing unrelated options", () => {
    const opts = ['CAMAROTE 10','CAMAROTE 02','CAMAROTE 01'].map((label,i)=>({id:String(i),label,sortOrder:i}));
    expect(orderTicketOptions(opts).map(x=>x.label)).toEqual(['CAMAROTE 01','CAMAROTE 02','CAMAROTE 10']);
    const other=opts.map((x,i)=>({...x,label:['Adulto','Criança','Família'][i]}));
    expect(orderTicketOptions(other)).toEqual(other);
  });
  it("serializes edits with an event row lock", async () => {
    const tx={ $queryRaw:vi.fn().mockResolvedValue([{id:'event'}]) };
    await lockEventLotOrder(tx as never,'event');
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR UPDATE');
    expect(tx.$queryRaw.mock.calls[0][1]).toBe('event');
  });
  it("normalizes unique positions including sold-out lots without changing commercial fields", async () => {
    const rows=[{...lot('a','OURO - MEIA',0),status:'ACTIVE',typeOptions:[]},{...lot('b','PRATA',0),status:'ACTIVE',typeOptions:[]},{...lot('c','OURO - INTEIRA',0),status:'SOLD_OUT',typeOptions:[]},{...lot('d','TESTE',0),status:'PAUSED',typeOptions:[]}];
    const tx={ticketLot:{findMany:vi.fn().mockResolvedValue(rows),update:vi.fn()},ticketLotOption:{update:vi.fn()}};
    await normalizeEventLotOrder(tx as never,'event');
    expect(tx.ticketLot.update.mock.calls.map(([x])=>x)).toEqual([{where:{id:'c'},data:{sortOrder:1}},{where:{id:'b'},data:{sortOrder:2}},{where:{id:'d'},data:{sortOrder:3}}]);
  });
});
