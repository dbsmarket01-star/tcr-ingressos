import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { RULES, entrySchema, hash, dateAtNoon, type EntryInput } from "./rules";
export type Tx = Prisma.TransactionClient;
export async function lockAccount(tx: Tx, organizationId: string) {
  const rows = await tx.$queryRaw<
    Array<{ organizationId: string }>
  >`SELECT "organizationId" FROM "FinancialLedgerAccount" WHERE "organizationId"=${organizationId} FOR UPDATE`;
  if (!rows.length) throw new Error("LEDGER_NOT_CONFIGURED");
}
export async function incident(
  tx: Tx,
  organizationId: string,
  key: string,
  kind: string,
  effectiveAt: Date,
  details: unknown,
) {
  return tx.financialIncident.upsert({
    where: { organizationId_key: { organizationId, key } },
    create: {
      organizationId,
      key,
      kind,
      effectiveAt,
      details: details as Prisma.InputJsonValue,
    },
    update: {
      resolvedAt: null,
      resolvedBy: null,
      resolutionEvidence: null,
      details: details as Prisma.InputJsonValue,
    },
  });
}
export async function audit(
  tx: Tx,
  organizationId: string,
  actorId: string,
  action: string,
  entityId: string,
  evidence: string,
  metadata: unknown = {},
) {
  return tx.financialLedgerAudit.create({
    data: {
      organizationId,
      actorId,
      action,
      entityId,
      evidence,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}
export async function appendEntry(
  tx: Tx,
  organizationId: string,
  input: EntryInput,
) {
  const entry = entrySchema.parse(input);
  await lockAccount(tx, organizationId);
  const [account, direction] = RULES[entry.type];
  const identity = {
    ...entry,
    metadata: undefined,
    evidence: undefined,
    organizationId,
    account,
    direction,
  };
  const fingerprint = hash(identity);
  const data = {
    id: randomUUID(),
    organizationId,
    sourceKey: entry.sourceKey,
    type: entry.type,
    account,
    direction,
    amountInCents: BigInt(entry.amountInCents),
    effectiveAt: dateAtNoon(entry.effectiveDate),
    verified: entry.verified,
    orderId: entry.orderId,
    paymentId: entry.paymentId,
    externalPaymentId: entry.externalPaymentId,
    transactionId: entry.transactionId,
    evidence: entry.evidence,
    metadata: entry.metadata as Prisma.InputJsonValue,
    fingerprint,
  };
  const inserted = await tx.financialLedgerEntry.createMany({
    data: [data],
    skipDuplicates: true,
  });
  const saved = await tx.financialLedgerEntry.findUniqueOrThrow({
    where: {
      organizationId_sourceKey: { organizationId, sourceKey: entry.sourceKey },
    },
  });
  if (saved.fingerprint !== fingerprint) {
    await incident(
      tx,
      organizationId,
      `duplicate:${hash(entry.sourceKey)}`,
      "DUPLICATE_SOURCE_CONFLICT",
      data.effectiveAt,
      {
        sourceKey: entry.sourceKey,
        existing: saved.id,
        receivedFingerprint: fingerprint,
      },
    );
    return { entry: saved, conflict: true, inserted: false };
  }
  if (inserted.count)
    await audit(
      tx,
      organizationId,
      "system",
      "ENTRY_APPENDED",
      saved.id,
      entry.evidence,
      { sourceKey: entry.sourceKey },
    );
  return { entry: saved, conflict: false, inserted: inserted.count === 1 };
}

export async function withLedgerTransaction<T>(
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
        timeout: 30000,
        maxWait: 10000,
      });
    } catch (error) {
      if (
        attempt >= 3 ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034"
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

export async function correctLedgerEntry(
  organizationId: string,
  actorId: string,
  input: { entryId: string; reason: string; replacement: EntryInput },
) {
  if (!input.reason.trim()) throw new Error("CORRECTION_EVIDENCE_REQUIRED");
  return withLedgerTransaction(async (tx) => {
    await lockAccount(tx, organizationId);
    const original = await tx.financialLedgerEntry.findFirstOrThrow({
      where: { id: input.entryId, organizationId },
    });
    if (original.type === "REVERSAL")
      throw new Error("CANNOT_REVERSE_REVERSAL");
    const replacement = entrySchema.parse(input.replacement);
    const reversalKey = `reversal:${original.id}`;
    const reversal = await tx.financialLedgerEntry.create({
      data: {
        organizationId,
        sourceKey: reversalKey,
        type: "REVERSAL",
        account: original.account,
        direction: original.direction === "CREDIT" ? "DEBIT" : "CREDIT",
        amountInCents: original.amountInCents,
        effectiveAt: original.effectiveAt,
        verified: true,
        orderId: original.orderId,
        paymentId: original.paymentId,
        externalPaymentId: original.externalPaymentId,
        transactionId: original.transactionId,
        reversalOfId: original.id,
        fingerprint: hash({ reversalOfId: original.id }),
        evidence: input.reason,
        metadata: { actorId, reason: input.reason },
      },
    });
    const result = await appendEntry(tx, organizationId, replacement);
    if (result.conflict || !result.inserted)
      throw new Error("CORRECTION_REQUIRES_NEW_UNIQUE_SOURCE");
    await audit(
      tx,
      organizationId,
      actorId,
      "ENTRY_CORRECTED",
      original.id,
      input.reason,
      { reversalId: reversal.id, replacementId: result.entry.id },
    );
    return result.entry;
  });
}
