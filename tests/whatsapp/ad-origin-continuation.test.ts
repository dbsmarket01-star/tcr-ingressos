import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { whatsAppMessageLog: { findFirst } } }));

import { verifiedAdOriginForConversation } from "@/features/ai/whatsapp-support-ai.service";

beforeEach(() => findFirst.mockReset());

describe("continuidade comprovada do anúncio no WhatsApp", () => {
  it("não consulta histórico quando a própria mensagem traz o referral", async () => {
    expect(await verifiedAdOriginForConversation({ organizationId: "org", phone: "5511999999999",
      current: { kind: "meta_ad", adId: "123" } })).toEqual({ kind: "meta_ad", adId: "123" });
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("mantém o ID do anúncio quando o cliente responde artista e cidade", async () => {
    findFirst.mockResolvedValue({ webhookPayload: { _tcrOrigin: { kind: "meta_ad", adId: "456" } } });
    expect(await verifiedAdOriginForConversation({ organizationId: "org", phone: "5511999999999",
      current: { kind: "support_default", adId: null } })).toEqual({ kind: "meta_ad", adId: "456" });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "RECEIVED" }) }));
  });
  it("não transforma conversa comum em anúncio sem referral", async () => {
    findFirst.mockResolvedValue(null);
    expect(await verifiedAdOriginForConversation({ organizationId: "org", phone: "5511999999999",
      current: { kind: "support_default", adId: null } })).toEqual({ kind: "support_default", adId: null });
  });
});
