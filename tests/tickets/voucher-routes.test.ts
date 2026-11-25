import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ ticket: vi.fn(), order: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/prisma", () => ({prisma:{ticket:{findFirst:mocks.ticket},order:{findFirst:mocks.order}}}));
vi.mock("@/features/organizations/organization.service", () => ({getCurrentOrganizationContext:async()=>({brandName:"TCR Ingressos",organization:{id:"org-tcr",publicDomain:"tcringressos.com.br"}})}));
vi.mock("resend",()=>({Resend: class {emails={send:mocks.send};}}));
import { GET as ticketGet } from "@/app/ingresso/[code]/pdf/route";
import { GET as orderGet } from "@/app/pedido/[code]/pdf/route";
import { createPublicTicketUrl, sendTicketsEmail } from "@/features/email/email.service";
const event={title:"Evento sintetico",startsAt:new Date("2027-03-20T23:00:00Z"),venueName:"Teatro",city:"Cidade",state:"SP",venueAddress:"Rua 1",importantInfo:"Portoes 19h"};
const ticket={code:"AMOSTRA-001",status:"ACTIVE",event,lot:{name:"CAMAROTE",description:"Documento obrigatorio"},lotOption:{label:"17"},order:{code:"ORDER-001",customer:{name:"Teste"}},issuedAt:new Date(),qrCodeToken:"synthetic-not-valid"};
beforeEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();});
it("scopes individual PDF and rejects missing/cancelled tickets",async()=>{
 mocks.ticket.mockResolvedValueOnce(null).mockResolvedValueOnce({...ticket,status:"CANCELED"}).mockResolvedValueOnce(ticket);
 const call=()=>ticketGet(new Request("https://example.invalid"),{params:Promise.resolve({code:ticket.code})});
 expect((await call()).status).toBe(404);expect((await call()).status).toBe(410);
 const res=await call();expect(res.status).toBe(200);expect(res.headers.get("content-type")).toBe("application/pdf");expect(res.headers.get("cache-control")).toBe("no-store");
 expect(mocks.ticket.mock.calls[0][0].where.event.organizationId).toBe("org-tcr");
 expect(await res.text()).toContain("CAMAROTE - 17");
});
it("exports separate tickets and filters invalid tickets inside the tenant query",async()=>{
 mocks.order.mockResolvedValue({code:"ORDER-001",event,customer:{name:"Teste"},tickets:[ticket,{...ticket,code:"AMOSTRA-002",lotOption:{label:"18"}}]});
 const res=await orderGet(new Request("https://example.invalid"),{params:Promise.resolve({code:"ORDER-001"})});
 const pdf=await res.text();expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(2);
 expect(pdf).toContain("CAMAROTE - 17");expect(pdf).toContain("CAMAROTE - 18");
 const query=mocks.order.mock.calls[0][0];expect(query.where.event.organizationId).toBe("org-tcr");expect(query.include.tickets.where.status.in).toEqual(["ACTIVE","USED"]);
});
it("delivers the official PDF links through the mocked email provider with each tenant domain",async()=>{
 vi.stubEnv("RESEND_API_KEY","synthetic-not-a-real-key"); mocks.send.mockResolvedValue({data:{id:"mock-only"},error:null});
 for (const publicDomain of ["tcringressos.com.br","a2.example.invalid","elo.example.invalid"]) {
 const url=createPublicTicketUrl(ticket.code,{publicDomain});
 expect(url).toBe(`https://${publicDomain}/ingresso/AMOSTRA-001/pdf`);
 await sendTicketsEmail({to:"qa@example.invalid",buyerName:"Teste",orderCode:"ORDER-001",brandName:"Teste",organization:{publicDomain},eventTitle:event.title,eventDate:event.startsAt,venueName:event.venueName,tickets:[{code:ticket.code,lotName:"CAMAROTE - 17",url}]});
 const sent=mocks.send.mock.calls.at(-1)?.[0];expect(sent.html).toContain(url);expect(sent.text).toContain(url);
 }
});
