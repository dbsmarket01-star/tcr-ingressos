import { beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { whatsAppMessageLog: db } }));
import { processWhatsAppSupportAiPayload } from "@/features/ai/whatsapp-support-ai.service";

const inbound = { id: "meta-test", from: "customer-test", type: "text", text: { body: "Olá" }, timestamp: "100" };
function receive() {
  return processWhatsAppSupportAiPayload({ entry: [{ changes: [{ value: { messages: [inbound] } }] }] });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WHATSAPP_AI_ENABLED", "true");
  db.findFirst.mockResolvedValue({ id: "log-test", organizationId: "org-test", webhookPayload: inbound });
});
it("permite que somente um processamento registre a decisão para duas entregas concorrentes", async () => {
  db.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  await Promise.all([receive(), receive()]);
  expect(db.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
    id: "log-test", status: "RECEIVED", webhookPayload: { equals: inbound }
  }}));
  expect(db.update).toHaveBeenCalledTimes(1);
  expect(db.update.mock.calls[0][0].data.webhookPayload._ai).toMatchObject({status:"SKIPPED",reason:expect.stringContaining("24 horas")});
});
