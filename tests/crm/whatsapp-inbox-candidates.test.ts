import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { buildInboxCandidateQuery } from "@/features/crm/whatsapp-chat.service";

const db = new PGlite();
afterAll(async () => db.close());

describe("WhatsApp inbox candidate query", () => {
  it("keeps the latest message, inbound, cart, human reply, order and refund without loading every log", async () => {
    await db.exec(`
      CREATE TABLE "WhatsAppMessageLog" (
        id text PRIMARY KEY, "organizationId" text, "orderId" text, "eventId" text,
        "recipientName" text, "recipientPhone" text, type text, status text,
        "templateName" text, payload jsonb, "webhookPayload" jsonb, "createdAt" timestamptz
      );
    `);
    const rows = [
      ["a1", "CART_ABANDONMENT", "SENT", "2026-10-20T10:00:00Z", null, null, null],
      ["a2", "BULK", "SENT", "2026-10-20T10:01:00Z", { humanAdminUserId: "admin" }, null, "order-1"],
      ["a3", "BULK", "RECEIVED", "2026-10-20T10:02:00Z", { text: { body: "Quero estorno" } }, null, null],
      ["a4", "BULK", "RECEIVED", "2026-10-20T10:03:00Z", { text: { body: "Obrigado" } }, null, null],
      ["a5", "BULK", "SENT", "2026-10-20T10:04:00Z", null, null, null],
      ["a6", "BULK", "SENT", "2026-10-20T10:05:00Z", null, null, null]
    ] as const;
    for (const [id, type, status, createdAt, payload, webhookPayload, orderId] of rows) {
      await db.query(`INSERT INTO "WhatsAppMessageLog" (id, "organizationId", "orderId", "recipientPhone", type, status, payload, "webhookPayload", "createdAt") VALUES ($1,'org',$2,'5511999999999',$3,$4,$5,$6,$7)`, [id, orderId, type, status, payload ? JSON.stringify(payload) : null, webhookPayload ? JSON.stringify(webhookPayload) : null, createdAt]);
    }
    await db.query(`INSERT INTO "WhatsAppMessageLog" (id, "organizationId", "recipientPhone", type, status, "createdAt") VALUES ('other','else','5511999999999','BULK','RECEIVED','2026-10-20T10:10:00Z')`);
    const query = buildInboxCandidateQuery({ organizationId: "org" });
    const result = await db.query<{ id: string }>(query.text, query.values);
    expect(result.rows.map((row) => row.id).sort()).toEqual(["a1", "a2", "a3", "a4", "a6"]);
    const scoped = buildInboxCandidateQuery({ organizationId: "org", startAt: new Date("2026-10-20T10:04:00Z") });
    const scopedResult = await db.query<{ id: string }>(scoped.text, scoped.values);
    expect(scopedResult.rows.map((row) => row.id).sort()).toEqual(["a6"]);
  });
});
