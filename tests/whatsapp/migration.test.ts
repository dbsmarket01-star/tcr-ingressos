import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    readFileSync(
      "prisma/migrations/20260930190000_whatsapp_campaigns/migration.sql",
      "utf8",
    ),
  );
  await db.exec(
    `INSERT INTO "WaContact"(id,"organizationId",phone,name,"updatedAt") VALUES('person','org','+5511987654321','Lucas',now());INSERT INTO "WaCampaign"(id,"organizationId","creationKey","createdBy","updatedAt") VALUES('campaign','org','key','admin',now());`,
  );
}, 30000);
afterAll(async () => db.close());
const add = (id: string) =>
  db.query(
    `INSERT INTO "WaMessageJob"(id,"organizationId","campaignId","contactId",phone,recipient,"clickToken","updatedAt") VALUES($1,'org','campaign','person','+5511987654321','{"name":"Lucas"}',$1,now()) ON CONFLICT DO NOTHING`,
    [id],
  );
it("enforces one recipient under concurrent insert attempts", async () => {
  await Promise.all([add("one"), add("two")]);
  expect((await db.query(`SELECT * FROM "WaMessageJob"`)).rows).toHaveLength(1);
});
it("prevents changing confirmed campaign content", async () => {
  await db.exec(
    `UPDATE "WaCampaign" SET status='queued',snapshot='{"message":"Olá"}',"snapshotHash"='hash',"confirmedAt"=now() WHERE id='campaign'`,
  );
  await expect(
    db.exec(
      `UPDATE "WaCampaign" SET config='{"message":"Outro"}' WHERE id='campaign'`,
    ),
  ).rejects.toThrow(/immutable/);
});
it("keeps recipient snapshots immutable", async () => {
  await expect(
    db.exec(`UPDATE "WaMessageJob" SET recipient='{"name":"Outra pessoa"}'`),
  ).rejects.toThrow(/immutable/);
});
it("rejects cross-tenant recipients", async () => {
  await expect(
    db.exec(
      `INSERT INTO "WaMessageJob"(id,"organizationId","campaignId","contactId",phone,recipient,"clickToken","updatedAt") VALUES('foreign','other','campaign','person','+5511987654321','{}','foreign',now())`,
    ),
  ).rejects.toThrow(/tenant/);
});
it("preserves an uncertain job without converting it back into queued", async () => {
  await db.exec(
    `UPDATE "WaMessageJob" SET state='deferred',uncertain=true,"errorCode"='UNCERTAIN'`,
  );
  const result = await db.query(
    `SELECT * FROM "WaMessageJob" WHERE state IN ('queued','deferred') AND NOT uncertain`,
  );
  expect(result.rows).toHaveLength(0);
});
it("rejects audit mutation", async () => {
  await db.exec(
    `INSERT INTO "WaAudit"(id,"organizationId","actorId",action,detail) VALUES('audit','org','admin','CONFIRMED','{}')`,
  );
  await expect(db.exec(`UPDATE "WaAudit" SET action='OTHER'`)).rejects.toThrow(
    /append-only/,
  );
  await expect(db.exec(`TRUNCATE "WaAudit"`)).rejects.toThrow(/append-only/);
});
