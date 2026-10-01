import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
async function insert(
  id: string,
  source = id,
  type = "SALE_PRINCIPAL",
  account = "PRODUCER",
  direction = "CREDIT",
  amount = 100,
) {
  return db.query(
    `INSERT INTO "FinancialLedgerEntry"(id,"organizationId","sourceKey",type,account,direction,"amountInCents","effectiveAt",verified,fingerprint,evidence,metadata) VALUES($1,'org',$2,$3,$4,$5,$6,'2026-09-24 15:00:00',true,'hash','evidence','{}') ON CONFLICT DO NOTHING`,
    [id, source, type, account, direction, amount],
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `CREATE TABLE "Organization"(id text PRIMARY KEY);CREATE TABLE "Event"(id text PRIMARY KEY,"organizationId" text);CREATE TABLE "Order"(id text PRIMARY KEY,"eventId" text);CREATE TABLE "Payment"(id text PRIMARY KEY,"orderId" text);`,
  );
  await db.exec(
    readFileSync(
      "prisma/migrations/20260930180000_financial_ledger/migration.sql",
      "utf8",
    ),
  );
  await db.exec(
    `INSERT INTO "Organization" VALUES('org');INSERT INTO "FinancialLedgerAccount"("organizationId","providerAccountId","startsOn","openingCashInCents","openingProducerInCents","openingReceivablesInCents","openingEvidence","createdBy") VALUES('org','wallet','2026-09-01',0,0,0,'audited opening','owner');`,
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL financial migration constraints", () => {
  it("serializes competing duplicate inserts into one entry", async () => {
    await Promise.all([insert("a", "same"), insert("b", "same")]);
    const result = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM "FinancialLedgerEntry" WHERE "sourceKey"='same'`,
    );
    expect(result.rows[0].count).toBe(1);
  });
  it("rejects inverted signs, nonpositive amounts, unknown types and wrong books", async () => {
    await expect(
      insert("wrong", "wrong", "SALE_PRINCIPAL", "PRODUCER", "DEBIT"),
    ).rejects.toThrow();
    await expect(
      insert("zero", "zero", "SALE_PRINCIPAL", "PRODUCER", "CREDIT", 0),
    ).rejects.toThrow();
    await expect(
      insert(
        "negative",
        "negative",
        "SALE_PRINCIPAL",
        "PRODUCER",
        "CREDIT",
        -1,
      ),
    ).rejects.toThrow();
    await expect(insert("unknown", "unknown", "OTHER")).rejects.toThrow();
    await expect(
      insert("book", "book", "SALE_PRINCIPAL", "CASH"),
    ).rejects.toThrow();
  });
  it("rejects updates and deletions of ledger and opening", async () => {
    await expect(
      db.exec(`UPDATE "FinancialLedgerEntry" SET "amountInCents"=1`),
    ).rejects.toThrow(/append-only/);
    await expect(db.exec(`DELETE FROM "FinancialLedgerEntry"`)).rejects.toThrow(
      /append-only/,
    );
    await expect(
      db.exec(`UPDATE "FinancialLedgerAccount" SET "openingCashInCents"=1`),
    ).rejects.toThrow(/append-only/);
  });
  it("protects tenant ownership", async () => {
    await db.exec(
      `INSERT INTO "Event" VALUES('foreign','other');INSERT INTO "Order" VALUES('foreign','foreign');`,
    );
    await expect(
      db.exec(
        `INSERT INTO "FinancialLedgerEntry"(id,"organizationId","sourceKey",type,account,direction,"amountInCents","effectiveAt",verified,fingerprint,evidence,metadata,"orderId") VALUES('tenant','org','tenant','SALE_PRINCIPAL','PRODUCER','CREDIT',1,now(),true,'x','x','{}','foreign')`,
      ),
    ).rejects.toThrow(/tenant/);
  });
  it("requires DRAFT insertion and blocks one-cent reconciliation", async () => {
    const base = `INSERT INTO "FinancialClosing"(id,"organizationId",date,revision,status,"sourceHash","sourceSnapshot","ledgerHash","ledgerSequence","ledgerCount",result,"createdBy") VALUES`;
    await expect(
      db.exec(
        `${base}('forged','org','2026-09-24',1,'PUBLISHED','h','{}','h',0,0,'{}','owner')`,
      ),
    ).rejects.toThrow(/DRAFT/);
    await db.exec(
      `${base}('close','org','2026-09-24',1,'DRAFT','h','{}','h',0,0,'{}','owner')`,
    );
    await expect(
      db.exec(
        `UPDATE "FinancialClosing" SET status='RECONCILED',"differenceInCents"=1 WHERE id='close'`,
      ),
    ).rejects.toThrow();
  });
  it("rejects stale publication then preserves a valid published snapshot", async () => {
    await db.exec(
      `UPDATE "FinancialClosing" SET status='RECONCILED' WHERE id='close'`,
    );
    await expect(
      db.exec(
        `UPDATE "FinancialClosing" SET status='PUBLISHED',"publishedBy"='owner',"publishedAt"=now() WHERE id='close'`,
      ),
    ).rejects.toThrow(/Stale/);
    await db.exec(
      `INSERT INTO "FinancialClosing"(id,"organizationId",date,revision,"sourceHash","sourceSnapshot","ledgerHash","ledgerSequence","ledgerCount",result,"createdBy") SELECT 'valid','org','2026-09-24',2,'h','{}','h',max(sequence),count(*),'{}','owner' FROM "FinancialLedgerEntry";UPDATE "FinancialClosing" SET status='RECONCILED' WHERE id='valid';UPDATE "FinancialClosing" SET status='PUBLISHED',"publishedBy"='owner',"publishedAt"=now() WHERE id='valid';`,
    );
    await expect(
      db.exec(`UPDATE "FinancialClosing" SET status='DRAFT' WHERE id='valid'`),
    ).rejects.toThrow(/immutable/);
    await insert("late");
    expect(
      (
        await db.query(
          `SELECT * FROM "FinancialIncident" WHERE kind='LATE_ENTRY_AFTER_PUBLICATION'`,
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("only allows one exact compensating reversal", async () => {
    await insert("original");
    const sql = `INSERT INTO "FinancialLedgerEntry"(id,"organizationId","sourceKey",type,account,direction,"amountInCents","effectiveAt",verified,fingerprint,evidence,metadata,"reversalOfId") VALUES($1,'org',$1,'REVERSAL','PRODUCER','DEBIT',$2,'2026-09-24 15:00:00',true,'h','correction','{}','original')`;
    await expect(db.query(sql, ["bad-reversal", 99])).rejects.toThrow(
      /Invalid reversal/,
    );
    await db.query(sql, ["reversal", 100]);
    await expect(db.query(sql, ["another-reversal", 100])).rejects.toThrow();
  });
  it("keeps audit append-only", async () => {
    await db.exec(
      `INSERT INTO "FinancialLedgerAudit"(id,"organizationId","actorId",action,"entityId",evidence,metadata) VALUES('audit','org','owner','TEST','close','evidence','{}')`,
    );
    await expect(db.exec(`DELETE FROM "FinancialLedgerAudit"`)).rejects.toThrow(
      /append-only/,
    );
    await expect(db.exec(`TRUNCATE "FinancialLedgerAudit"`)).rejects.toThrow(
      /append-only/,
    );
  });
});
