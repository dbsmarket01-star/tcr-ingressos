import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizePhone, isOptOut, classifyError } from "./rules";
import { transaction, audit } from "./service";
import { json } from "./meta";
/** Called only after HMAC verification. Each provider event is durably deduplicated. */
export async function campaignWebhook(payload: any) {
  for (const entry of payload?.entry ?? [])
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      if (
        change.field === "message_template_status_update" &&
        value.message_template_id
      ) {
        const owners = await prisma.waIntegration.findMany({
          where: { wabaId: String(entry.id) },
        });
        for (const owner of owners)
          await transaction(async (tx) => {
            const templates = await tx.waTemplate.findMany({
              where: {
                organizationId: owner.organizationId,
                metaId: String(value.message_template_id),
              },
            });
            await tx.waTemplate.updateMany({
              where: {
                organizationId: owner.organizationId,
                metaId: String(value.message_template_id),
              },
              data: {
                status: String(value.event),
                reviewReason:
                  value.event === "REJECTED"
                    ? value.reason
                      ? String(value.reason).slice(0, 1000)
                      : null
                    : null,
                syncedAt: new Date(),
              },
            });
            if (value.event !== "APPROVED")
              await tx.waCampaign.updateMany({
                where: {
                  organizationId: owner.organizationId,
                  templateId: { in: templates.map((t) => t.id) },
                  status: { in: ["queued", "scheduled", "sending"] },
                },
                data: {
                  status: "paused",
                  pauseReason: "Template não aprovado na Meta.",
                },
              });
          });
        continue;
      }
      const phoneId = value.metadata?.phone_number_id;
      const integration = phoneId
        ? await prisma.waIntegration.findUnique({
            where: { phoneNumberId: String(phoneId) },
          })
        : await prisma.waIntegration.findFirst({
            where: { wabaId: String(entry.id) },
          });
      if (!integration || integration.wabaId !== String(entry.id)) continue;
      const org = integration.organizationId;
      for (const status of value.statuses ?? []) {
        if (
          !status.id ||
          !["sent", "delivered", "read", "failed"].includes(status.status)
        )
          continue;
        const at = new Date(Number(status.timestamp) * 1000);
        if (!Number.isFinite(at.getTime())) continue;
        await transaction(async (tx) => {
          const job = await tx.waMessageJob.findFirst({
            where: {
              organizationId: org,
              campaign: { phoneNumberId: integration.phoneNumberId },
              OR: [
                { providerMessageId: status.id },
                ...(status.biz_opaque_callback_data
                  ? [{ attemptId: String(status.biz_opaque_callback_data) }]
                  : []),
              ],
            },
          });
          if (!job) return;
          if (normalizePhone(status.recipient_id) !== job.phone) return;
          const sourceKey = `meta:${status.id}:${status.status}:${status.timestamp}`;
          const inserted = await tx.waMessageEvent.createMany({
            data: [
              {
                sourceKey,
                jobId: job.id,
                organizationId: org,
                providerMessageId: status.id,
                phone: job.phone,
                kind: status.status,
                happenedAt: at,
                detail: json(status),
              },
            ],
            skipDuplicates: true,
          });
          if (!inserted.count) return;
          await tx.$queryRaw`SELECT id FROM "WaMessageJob" WHERE id=${job.id} FOR UPDATE`;
          const current = await tx.waMessageJob.findUniqueOrThrow({
            where: { id: job.id },
          });
          const rank: Record<string, number> = {
            queued: 0,
            deferred: 0,
            sending: 0,
            failed: 0,
            cancelled: 0,
            sent: 1,
            delivered: 2,
            read: 3,
          };
          const next =
            status.status === "failed"
              ? current.deliveredAt || current.readAt
                ? current.state
                : "failed"
              : rank[status.status] > (rank[current.state] ?? 0)
                ? status.status
                : current.state;
          const field = (
            {
              sent: "sentAt",
              delivered: "deliveredAt",
              read: "readAt",
              failed: "failedAt",
            } as const
          )[status.status as "sent" | "delivered" | "read" | "failed"];
          await tx.waMessageJob.update({
            where: { id: job.id },
            data: {
              state: next,
              providerMessageId: status.id,
              uncertain: false,
              acceptedAt: current.acceptedAt ?? at,
              [field]: current[field] ?? at,
              ...(status.status === "failed"
                ? {
                    errorCode: String(
                      status.errors?.[0]?.code ?? "META_FAILED",
                    ),
                    errorMessage: String(
                      status.errors?.[0]?.title ?? "Falha informada pela Meta",
                    ).slice(0, 800),
                  }
                : { errorCode: null, errorMessage: null }),
            },
          });
          if (status.status === "read")
            await tx.waContact.update({
              where: { id: job.contactId },
              data: { unengagedCount: 0, cooldownUntil: null },
            });
          if (status.status === "failed") {
            const code = Number(status.errors?.[0]?.code ?? 0);
            const action = classifyError(code);
            if (["pause", "rate", "transient"].includes(action)) {
              const reason = `Meta: ${status.errors?.[0]?.title ?? code}`;
              await tx.waIntegration.update({
                where: { id: integration.id },
                data: { blockedReason: reason },
              });
              await tx.waCampaign.updateMany({
                where: {
                  organizationId: org,
                  status: { in: ["queued", "scheduled", "sending"] },
                },
                data: { status: "paused", pauseReason: reason },
              });
            }
            await audit(
              tx,
              org,
              "meta:webhook",
              "DELIVERY_FAILED",
              job.campaignId,
              { jobId: job.id, code },
            );
          }
        });
      }
      for (const message of value.messages ?? []) {
        const phone = normalizePhone(message.from);
        if (!phone || !message.id) continue;
        const at = new Date(Number(message.timestamp) * 1000);
        if (!Number.isFinite(at.getTime())) continue;
        const text =
          message.text?.body ??
          message.button?.payload ??
          message.button?.text ??
          message.interactive?.button_reply?.id ??
          message.interactive?.button_reply?.title ??
          "";
        const optOut =
          isOptOut(text) ||
          isOptOut(
            message.button?.text ??
              message.interactive?.button_reply?.title ??
              "",
          );
        await transaction(async (tx) => {
          const sourceKey = `inbound:${message.id}`;
          const inserted = await tx.waMessageEvent.createMany({
            data: [
              {
                sourceKey,
                organizationId: org,
                providerMessageId: message.id,
                phone,
                kind: optOut ? "opt_out" : "reply",
                happenedAt: at,
                detail: json({
                  context: message.context ?? null,
                  type: message.type,
                }),
              },
            ],
            skipDuplicates: true,
          });
          if (!inserted.count) return;
          const contact = await tx.waContact.findUnique({
            where: { organizationId_phone: { organizationId: org, phone } },
          });
          if (contact)
            await tx.waContact.update({
              where: { id: contact.id },
              data: {
                lastInboundAt: at,
                unengagedCount: 0,
                cooldownUntil: null,
                ...(optOut ? { optInStatus: "opt_out" } : {}),
              },
            });
          if (optOut) {
            await tx.waSuppression.upsert({
              where: { organizationId_phone: { organizationId: org, phone } },
              create: {
                organizationId: org,
                phone,
                reason: "Descadastro solicitado pelo destinatário",
                source: message.id,
              },
              update: {},
            });
            await tx.waMessageJob.updateMany({
              where: {
                organizationId: org,
                phone,
                state: { in: ["queued", "deferred"] },
                uncertain: false,
              },
              data: {
                state: "cancelled",
                errorMessage: "Descadastro solicitado",
                optedOutAt: at,
              },
            });
            await audit(tx, org, "meta:webhook", "CONTACT_OPTED_OUT", null, {
              phone,
              messageId: message.id,
            });
          }
          const contextual = message.context?.id
            ? await tx.waMessageJob.findFirst({
                where: {
                  organizationId: org,
                  phone,
                  providerMessageId: message.context.id,
                },
              })
            : null;
          const job =
            contextual ??
            (await tx.waMessageJob.findFirst({
              where: {
                organizationId: org,
                phone,
                acceptedAt: {
                  lte: at,
                  gte: new Date(at.getTime() - 7 * 86400000),
                },
              },
              orderBy: { acceptedAt: "desc" },
            }));
          if (job) {
            await tx.waMessageJob.update({
              where: { id: job.id },
              data: {
                repliedAt: job.repliedAt ?? at,
                ...(optOut ? { optedOutAt: job.optedOutAt ?? at } : {}),
              },
            });
            await tx.waMessageEvent.update({
              where: { sourceKey },
              data: { jobId: job.id },
            });
          }
        });
      }
    }
}
