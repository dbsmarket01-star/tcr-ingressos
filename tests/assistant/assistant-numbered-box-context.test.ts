import { beforeEach, expect, it, vi } from "vitest";
const s=vi.hoisted(()=>({rows:[] as any[],fees:[{serviceFeeBps:2000,cardInterestBpsPerInstallment:400,cardInterestStartsAtInstallment:2}]}));
vi.mock("@/lib/prisma",()=>({prisma:{adminAuditLog:{findFirst:async({where}:any)=>s.rows.filter(r=>r.action===where.action && r.adminUserId===where.adminUserId && r.metadata.organizationId===where.metadata.equals).at(-1),create:async({data}:any)=>{const r={...data,id:`row${s.rows.length}`};s.rows.push(r);return r;}},ticketLot:{findMany:async()=>s.fees}}}));
import {prisma} from "@/lib/prisma";
import {handleNumberedBoxRequest,finishNumberedBoxDraft} from "@/features/assistant/assistant-numbered-box.service";
const admin={id:'lucas',organizationId:'org'} as any;
const events=[{id:'evt_guilherme_test',title:'Guilherme Arantes em São Caetano',city:'São Caetano',slug:'g',startsAt:new Date('2027-03-20'),status:'PUBLISHED'},{id:'evt_rodrigo_test',title:'Rodrigo',city:'São Caetano',slug:'r',startsAt:new Date('2027-03-20'),status:'PUBLISHED'}];
const rank=(text:string,e:any)=> text.includes(`ID ${e.id}`)||text.includes(e.title)?100:0;
beforeEach(()=>{s.rows=[];s.fees=[{serviceFeeBps:2000,cardInterestBpsPerInstallment:400,cardInterestStartsAtInstallment:2}];(prisma.adminAuditLog.findFirst as any)=async({where}:any)=>s.rows.filter(r=>r.action===where.action&&r.adminUserId===where.adminUserId&&r.metadata.organizationId===where.metadata.equals).at(-1);});
it('persists user intent across more than twelve transcript messages and does not borrow Rodrigo',async()=>{
 let response=await handleNumberedBoxRequest(admin,'Crie camarotes 17,18 e 19 para 10 pessoas no ID evt_guilherme_test',events,rank);
 for(let i=0;i<14;i++) response=await handleNumberedBoxRequest(admin,'sobe',events,rank);
 response=await handleNumberedBoxRequest(admin,'CAMAROTE 17 sem descrição 1497,90 ativo',events,rank);
 // Explicit new numbering replaces the selection; restore requested complete selection.
 response=await handleNumberedBoxRequest(admin,'camarotes 17,18 e 19; taxa da bilheteria padrão; parcelamento padrão',events,rank);
 expect(response?.proposal?.plan).toMatchObject({eventId:'evt_guilherme_test',numbers:[17,18,19],admissionsPerUnit:10,priceInCents:149790,serviceFeeBps:2000,cardInterestBpsPerInstallment:400});
});
it('does not expose Lucas draft to Diego or another organization',async()=>{
 await handleNumberedBoxRequest(admin,'Crie camarotes 17,18 e 19 para 10 pessoas no ID evt_guilherme_test',events,rank);
 expect(await handleNumberedBoxRequest({...admin,id:'diego'},'sobe',events,rank)).toBeNull();
 expect(await handleNumberedBoxRequest({...admin,organizationId:'other'},'sobe',events,rank)).toBeNull();
});
it('clears previous fields when explicitly switching events',async()=>{
 await handleNumberedBoxRequest(admin,'Crie camarotes 17,18 e 19 para 10 pessoas no ID evt_guilherme_test, valor1497,90',events,rank);
 const response=await handleNumberedBoxRequest(admin,'Crie camarotes 33,34 para 8 pessoas no ID evt_rodrigo_test',events,rank);
 expect(response?.proposal).toBeNull();expect(response?.text).toContain('preço por camarote');
});
it('does not invent inconsistent standard fees',async()=>{
 s.fees.push({serviceFeeBps:1000,cardInterestBpsPerInstallment:200,cardInterestStartsAtInstallment:2});
 const response=await handleNumberedBoxRequest(admin,'Crie camarotes 17,18 e 19 para 10 pessoas no ID evt_guilherme_test, R$1497,90, taxa da bilheteria padrão, parcelamento padrão',events,rank);
 expect(response?.proposal).toBeNull();expect(response?.text).toContain('taxa de bilheteria');
});
it('does not revive an applied request with a vague followup',async()=>{
 await handleNumberedBoxRequest(admin,'Crie camarotes 17,18 e 19 para 10 pessoas no ID evt_guilherme_test',events,rank);await finishNumberedBoxDraft(admin);
 expect(await handleNumberedBoxRequest(admin,'sobe',events,rank)).toBeNull();
});
