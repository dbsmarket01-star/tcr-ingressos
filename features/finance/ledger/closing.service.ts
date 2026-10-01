import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  audit,
  appendEntry,
  incident,
  lockAccount,
  withLedgerTransaction,
  type Tx,
} from "./store";
import {
  dayEnd,
  dayKey,
  hash,
  RULES,
  sum,
  type EntryKind,
  dateAtNoon,
  signedCentsSchema,
} from "./rules";
import {
  chargeRefund,
  evaluateReconciliation,
  snapshotSchema,
  statementKind,
  type FinancialSnapshot,
} from "./reconciliation";
import { fetchAsaasFinancialSnapshot } from "./asaas-source";
import { recordOrderFinancialState } from "./payment-ledger";

export const openingSchema = z
  .object({
    providerAccountId: z.string().min(1),
    startsOn: z.iso.date(),
    openingCashInCents: signedCentsSchema,
    openingProducerInCents: signedCentsSchema,
    openingReceivablesInCents: signedCentsSchema,
    openingEvidence: z.string().min(10).max(4000),
  })
  .strict();
export async function configureLedger(
  organizationId: string,
  actorId: string,
  data: unknown,
) {
  const input = openingSchema.parse(data);
  return withLedgerTransaction(async (tx) => {
    const organization = await tx.organization.findFirstOrThrow({
      where: { id: organizationId, slug: "tcr-ingressos" },
    });
    const created = await tx.financialLedgerAccount.create({
      data: {
        organizationId: organization.id,
        createdBy: actorId,
        ...input,
        startsOn: new Date(`${input.startsOn}T00:00:00Z`),
        openingCashInCents: BigInt(input.openingCashInCents),
        openingProducerInCents: BigInt(input.openingProducerInCents),
        openingReceivablesInCents: BigInt(input.openingReceivablesInCents),
      },
    });
    await audit(
      tx,
      organizationId,
      actorId,
      "LEDGER_OPENED",
      organizationId,
      input.openingEvidence,
      input,
    );
    return created;
  });
}
async function ledgerSnapshot(tx: Tx, organizationId: string, date: string) {
  const entries = await tx.financialLedgerEntry.findMany({
    where: { organizationId, effectiveAt: { lte: dayEnd(date) } },
    orderBy: { sequence: "asc" },
  });
  return {
    entries,
    ledgerHash: hash(
      entries.map((e) => [e.id, e.fingerprint, e.sequence.toString()]),
    ),
    ledgerSequence: entries.at(-1)?.sequence ?? BigInt(0),
    ledgerCount: entries.length,
  };
}

export async function reconcileDailyLedger(
  organizationId: string,
  actorId: string,
  date: string,
) {
  z.iso.date().parse(date);
  if (date >= dayKey(new Date())) throw new Error("CLOSED_DAY_REQUIRED");
  const config = await prisma.financialLedgerAccount.findUniqueOrThrow({
    where: { organizationId },
  });
  if (date < config.startsOn.toISOString().slice(0, 10))
    throw new Error("DATE_BEFORE_LEDGER_OPENING");
  const organization = await prisma.organization.findFirstOrThrow({
    where: { id: organizationId, slug: "tcr-ingressos" },
  });
  let source: FinancialSnapshot;
  try {
    source = await fetchAsaasFinancialSnapshot(organization, {
      accountId: config.providerAccountId,
      startDate: config.startsOn.toISOString().slice(0, 10),
      endDate: date,
    });
  } catch (error) {
    source = {
      accountId: config.providerAccountId,
      startDate: config.startsOn.toISOString().slice(0, 10),
      endDate: date,
      capturedAt: new Date().toISOString(),
      complete: false,
      closingBalanceInCents: null,
      charges: [],
      transactions: [],
      issues: [error instanceof Error ? error.message : "SOURCE_UNAVAILABLE"],
    };
  }
  return persistReconciliation(organizationId, actorId, source);
}
/** Internal entrypoint; HTTP callers cannot submit their own provider snapshot. */
export async function persistReconciliation(
  organizationId: string,
  actorId: string,
  raw: FinancialSnapshot,
) {
  const source = snapshotSchema.parse(raw);
  return withLedgerTransaction(async (tx) => {
    await lockAccount(tx, organizationId);
    const config = await tx.financialLedgerAccount.findUniqueOrThrow({
      where: { organizationId },
    });
    if (
      source.accountId !== config.providerAccountId ||
      source.startDate !== config.startsOn.toISOString().slice(0, 10)
    )
      throw new Error("SNAPSHOT_SCOPE_MISMATCH");
    const date = source.endDate;
    const orders = await tx.order.findMany({
      where: {
        event: { organizationId },
        payment: { provider: "ASAAS" },
        paidAt: { lte: dayEnd(date) },
      },
      include: { payment: true },
    });
    for (const order of orders) await recordOrderFinancialState(tx, order.id);
    for (const row of source.transactions) {
      const type = statementKind(row);
      if (
        !type ||
        !row.amountInCents ||
        Math.sign(row.amountInCents) !==
          (RULES[type][1] === "CREDIT" ? 1 : -1) ||
        row.date < source.startDate ||
        row.date > date
      )
        continue;
      const common = {
        amountInCents: Math.abs(row.amountInCents),
        effectiveDate: row.date,
        verified: true,
        evidence: `Asaas financialTransactions/${row.id}`,
        transactionId: row.id,
        externalPaymentId: row.paymentId ?? undefined,
      };
      await appendEntry(tx, organizationId, {
        ...common,
        type,
        sourceKey: `asaas:transaction:${row.id}:cash`,
      });
      const costType: EntryKind | null =
        type === "CASH_FEE"
          ? "ASAAS_FEE"
          : type === "CASH_FEE_REVERSAL"
            ? "ASAAS_FEE_REVERSAL"
            : type === "CASH_SPLIT"
              ? "SPLIT"
              : type === "CASH_SPLIT_REVERSAL"
                ? "SPLIT_REVERSAL"
                : null;
      if (costType)
        await appendEntry(tx, organizationId, {
          ...common,
          type: costType,
          sourceKey: `asaas:transaction:${row.id}:classification`,
        });
    }
    // Settle each receivable once; these are accounting entries, never Asaas transfers.
    for (const charge of source.charges) {
      if (!charge.paidDate || charge.paidDate > date) continue;
      const order = orders.find((o) => o.code === charge.orderCode);
      const credited = Boolean(charge.creditDate && charge.creditDate <= date);
      const refunded = chargeRefund(
        charge,
        credited ? charge.creditDate! : date,
      );
      const settled = credited
        ? Math.max(0, charge.grossInCents - refunded)
        : 0;
      for (const [type, target, effectiveDate] of [
        ["RECEIVABLE_SETTLED", settled, charge.creditDate],
        [
          "RECEIVABLE_REFUND",
          refunded,
          charge.refunds
            .filter((r) => r.date && r.date <= date)
            .map((r) => r.date!)
            .sort()
            .at(-1),
        ],
      ] as [EntryKind, number, string | null | undefined][]) {
        if (
          !target ||
          !effectiveDate ||
          effectiveDate < source.startDate ||
          !order
        )
          continue;
        const existing = await tx.financialLedgerEntry.aggregate({
          where: {
            organizationId,
            type,
            externalPaymentId: charge.id,
            reversals: { none: {} },
          },
          _sum: { amountInCents: true },
        });
        const difference = target - Number(existing._sum.amountInCents ?? 0);
        if (difference > 0)
          await appendEntry(tx, organizationId, {
            type,
            sourceKey: `asaas:${charge.id}:${type}:${target}`,
            amountInCents: difference,
            effectiveDate,
            verified: true,
            orderId: order.id,
            paymentId: order.payment?.id,
            externalPaymentId: charge.id,
            evidence: `Asaas payments/${charge.id}`,
          });
        if (difference < 0)
          await incident(
            tx,
            organizationId,
            `receivable-regression:${charge.id}:${type}`,
            "RECEIVABLE_REGRESSION",
            dateAtNoon(date),
            { target, recorded: Number(existing._sum.amountInCents ?? 0) },
          );
      }
    }
    const ledger = await ledgerSnapshot(tx, organizationId, date);
    const result = evaluateReconciliation({
      snapshot: source,
      orders: orders.map((o) => ({ ...o, paidDate: dayKey(o.paidAt!) })),
      entries: ledger.entries.map((e) => ({
        ...e,
        amountInCents: Number(e.amountInCents),
      })),
      openingCashInCents: Number(config.openingCashInCents),
      openingProducerInCents: Number(config.openingProducerInCents),
      openingReceivablesInCents: Number(config.openingReceivablesInCents),
    });
    for (const mismatch of result.mismatches)
      await incident(
        tx,
        organizationId,
        `close:${date}:${mismatch.kind}:${hash(mismatch.key)}`,
        mismatch.kind,
        dateAtNoon(date),
        JSON.parse(JSON.stringify(mismatch)),
      );
    const unresolved = await tx.financialIncident.findMany({
      where: {
        organizationId,
        resolvedAt: null,
        effectiveAt: { lte: dayEnd(date) },
      },
      select: { id: true },
    });
    if (unresolved.length) {
      result.status = "BLOCKED";
      result.issues.push(
        ...unresolved.map((x) => `UNRESOLVED_INCIDENT:${x.id}`),
      );
    }
    const latest = await tx.financialClosing.aggregate({
      where: { organizationId, date: new Date(`${date}T00:00:00Z`) },
      _max: { revision: true },
    });
    const draft = await tx.financialClosing.create({
      data: {
        organizationId,
        date: new Date(`${date}T00:00:00Z`),
        revision: (latest._max.revision ?? 0) + 1,
        status: "DRAFT",
        sourceHash: hash(source),
        sourceSnapshot: source as Prisma.InputJsonValue,
        ledgerHash: ledger.ledgerHash,
        ledgerSequence: ledger.ledgerSequence,
        ledgerCount: ledger.ledgerCount,
        result: {},
        createdBy: actorId,
      },
    });
    const closing = await tx.financialClosing.update({
      where: { id: draft.id },
      data: {
        status: result.status,
        result: result as Prisma.InputJsonValue,
        differenceInCents: BigInt(result.differenceInCents),
        issueCount: result.issues.length,
      },
    });
    await audit(
      tx,
      organizationId,
      actorId,
      "CLOSING_RECONCILED",
      closing.id,
      `Asaas snapshot ${closing.sourceHash}`,
      { status: closing.status, date, revision: closing.revision },
    );
    return closing;
  });
}
export async function publishClosing(
  organizationId: string,
  actorId: string,
  closingId: string,
) {
  return withLedgerTransaction(async (tx) => {
    await lockAccount(tx, organizationId);
    const closing = await tx.financialClosing.findFirstOrThrow({
      where: { id: closingId, organizationId },
    });
    if (
      closing.status !== "RECONCILED" ||
      closing.differenceInCents !== BigInt(0) ||
      closing.issueCount
    )
      throw new Error("CLOSING_BLOCKED");
    const date = closing.date.toISOString().slice(0, 10),
      ledger = await ledgerSnapshot(tx, organizationId, date);
    const unresolved = await tx.financialIncident.count({
      where: {
        organizationId,
        resolvedAt: null,
        effectiveAt: { lte: dayEnd(date) },
      },
    });
    if (ledger.ledgerHash !== closing.ledgerHash || unresolved)
      throw new Error("CLOSING_STALE_OR_BLOCKED");
    const published = await tx.financialClosing.update({
      where: { id: closingId },
      data: {
        status: "PUBLISHED",
        publishedBy: actorId,
        publishedAt: new Date(),
      },
    });
    await audit(
      tx,
      organizationId,
      actorId,
      "CLOSING_PUBLISHED",
      closingId,
      `Ledger ${closing.ledgerHash}`,
      { date, revision: closing.revision, sourceHash: closing.sourceHash },
    );
    return published;
  });
}

export async function allocateWithdrawal(
  organizationId: string,
  actorId: string,
  transactionId: string,
  producerInCents: number,
  evidence: string,
) {
  signedCentsSchema.parse(producerInCents);
  if (producerInCents < 0 || evidence.trim().length < 10)
    throw new Error("ALLOCATION_EVIDENCE_REQUIRED");
  return withLedgerTransaction(async (tx) => {
    await lockAccount(tx, organizationId);
    const cash = await tx.financialLedgerEntry.findFirstOrThrow({
      where: { organizationId, transactionId, type: "CASH_WITHDRAWAL" },
    });
    if (producerInCents > Number(cash.amountInCents))
      throw new Error("ALLOCATION_EXCEEDS_WITHDRAWAL");
    const entries = [];
    for (const [type, amount] of [
      ["PRODUCER_WITHDRAWAL", producerInCents],
      ["BILHETERIA_WITHDRAWAL", Number(cash.amountInCents) - producerInCents],
    ] as [EntryKind, number][]) {
      if (!amount) continue;
      entries.push(
        await appendEntry(tx, organizationId, {
          type,
          amountInCents: amount,
          sourceKey: `withdrawal:${transactionId}:${type}`,
          transactionId,
          effectiveDate: dayKey(cash.effectiveAt),
          verified: true,
          evidence,
          metadata: { actorId },
        }),
      );
    }
    await audit(
      tx,
      organizationId,
      actorId,
      "WITHDRAWAL_ALLOCATED",
      cash.id,
      evidence,
      { producerInCents, transactionId },
    );
    return entries;
  });
}
export async function resolveFinancialIncident(
  organizationId: string,
  actorId: string,
  incidentId: string,
  evidence: string,
) {
  if (evidence.trim().length < 10)
    throw new Error("RESOLUTION_EVIDENCE_REQUIRED");
  return withLedgerTransaction(async (tx) => {
    await lockAccount(tx, organizationId);
    const row = await tx.financialIncident.findFirstOrThrow({
      where: { id: incidentId, organizationId },
    });
    const resolved = await tx.financialIncident.update({
      where: { id: row.id },
      data: {
        resolvedAt: new Date(),
        resolvedBy: actorId,
        resolutionEvidence: evidence,
      },
    });
    await audit(
      tx,
      organizationId,
      actorId,
      "INCIDENT_RESOLVED",
      row.id,
      evidence,
      { kind: row.kind },
    );
    // A fresh reconciliation is still required. Resolving an incident never changes a blocked close.
    return resolved;
  });
}
