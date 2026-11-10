import { expect, it, vi } from "vitest";
const globalRead = vi.hoisted(() => vi.fn(() => { throw new Error("Global connection must not be used inside import transaction"); }));
vi.mock("@/lib/prisma", () => ({ prisma: { organization: {findUnique:globalRead}, event:{findFirst:globalRead,create:globalRead} } }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { createEvent } from "@/features/events/event.service";
import { eventDraftSchema } from "@/features/events/event.schema";
it("inherits tracking using the transaction connection even with a single-connection pool",async()=>{
 const tx:any={organization:{findUnique:vi.fn(async()=>({slug:"tcr-ingressos"}))},event:{findFirst:vi.fn(async()=>({metaPixelId:"test-pixel",metaConversionsApiToken:"test-token"})),create:vi.fn(async({data})=>data)}};
 const input=eventDraftSchema.parse({title:"Evento teste",slug:"evento-teste",startsAt:"2035-12-12T19:00:00-03:00",venueName:"Local teste",venueAddress:"Rua de testes, 100",city:"São Paulo",state:"SP"});
 const result=await createEvent({...input,status:"DRAFT"},"org",tx);
 expect(result.metaPixelId).toBe("test-pixel");expect(globalRead).not.toHaveBeenCalled();expect(tx.event.create).toHaveBeenCalledOnce();
});
