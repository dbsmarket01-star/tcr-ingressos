import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { buildInboxCandidateQuery, buildIndexedInboxCandidateQuery } from "@/features/crm/whatsapp-chat.service";

const db = new PGlite();
afterAll(async () => db.close());

describe("WhatsApp inbox candidate query", () => {
  it("keeps the latest message, inbound, cart, human reply, order and refund without loading every log", async () => {
    await db.exec(`
      CREATE TYPE "WhatsAppMessageType" AS ENUM ('AI_ASSISTANT', 'PURCHASE_APPROVED', 'CART_ABANDONMENT', 'BULK', 'WEBHOOK');
      CREATE TABLE "WhatsAppMessageLog" (
        id text PRIMARY KEY, "organizationId" text, "orderId" text, "eventId" text,
        "recipientName" text, "recipientPhone" text, type "WhatsAppMessageType", status text,
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
  it("preserves name/order history, normalized phones, ties and date boundaries", async () => {
    const rows = [
      ["b-name", "5511888888888", "2026-10-19T10:00:00Z", "SENT", "BULK", "Nome", null, null],
      ["b-order", "+55 (11) 88888-8888", "2026-10-19T11:00:00Z", "SENT", "BULK", null, "order", null],
      ["b-human", "11888888888", "2026-10-19T12:00:00Z", "SENT", "BULK", null, null, {humanAdminUserId:"admin"}],
      ["b-failed", "5511888888888", "2026-10-19T13:00:00Z", "FAILED", "BULK", null, null, {humanAdminUserId:"admin"}],
      ["b-cart", "5511888888888", "2026-10-19T14:00:00Z", "SENT", "CART_ABANDONMENT", null, null, null],
      ["b-in", "5511888888888", "2026-10-19T15:00:00Z", "RECEIVED", "BULK", null, null, null],
      ["b-tie-a", "5511888888888", "2026-10-19T16:00:00Z", "SENT", "BULK", null, null, null],
      ["b-tie-z", "5511888888888", "2026-10-19T16:00:00Z", "SENT", "BULK", null, null, null],
      ["b-empty", "", "2026-10-19T17:00:00Z", "SENT", "BULK", null, null, null],
      ["b-end", "5511888888888", "2026-10-20T00:00:00Z", "SENT", "BULK", null, null, null]
    ];
    for (const [id, phone, date, status, type, name, order, payload] of rows) {
      await db.query(`INSERT INTO "WhatsAppMessageLog" (id, "organizationId", "recipientPhone", "createdAt", status, type, "recipientName", "orderId", payload) VALUES ($1,'org-boundary',$2,$3,$4,$5,$6,$7,$8)`, [id, phone, date, status, type, name, order, payload ? JSON.stringify(payload) : null]);
    }
    const query = buildInboxCandidateQuery({organizationId:"org-boundary",startAt:new Date("2026-10-19T10:00:00Z"),endAt:new Date("2026-10-20T00:00:00Z")});
    const result = await db.query<{id:string}>(query.text,query.values);
    expect(result.rows.map(row=>row.id)).toEqual(["b-tie-z","b-in","b-cart","b-human","b-order","b-name"]);
  });

  it("keeps the persisted index equal to the historical query through inserts, updates and deletes", async () => {
    const migration = readFileSync("prisma/migrations/20261020230000_whatsapp_conversation_candidates/migration.sql", "utf8")
      .replace(/CREATE INDEX CONCURRENTLY/g, "CREATE INDEX");
    await db.exec(migration);
    async function expectParity(org: string) {
      const oldQuery = buildInboxCandidateQuery({ organizationId: org });
      const indexedQuery = buildIndexedInboxCandidateQuery(org);
      const [oldRows, indexedRows] = await Promise.all([
        db.query<{ id: string }>(oldQuery.text, oldQuery.values),
        db.query<{ id: string }>(indexedQuery.text, indexedQuery.values)
      ]);
      expect(indexedRows.rows.map((row) => row.id)).toEqual(oldRows.rows.map((row) => row.id));
    }
    await expectParity("org");
    await expectParity("org-boundary");
    await db.query(`INSERT INTO "WhatsAppMessageLog" (id, "organizationId", "recipientPhone", type, status, payload, "createdAt") VALUES ('a7','org','+55 (11) 99999-9999','BULK','RECEIVED','{"text":{"body":"Quero reembolso"}}','2026-10-20T10:06:00Z')`);
    await expectParity("org");
    await db.query(`UPDATE "WhatsAppMessageLog" SET status='SENT', "recipientPhone"='5511888888888' WHERE id='a7'`);
    await expectParity("org");
    await expectParity("org-boundary");
    await db.query(`DELETE FROM "WhatsAppMessageLog" WHERE id='a7'`);
    await expectParity("org");
  });

});
