import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  configSchema,
  paceDelay,
  classifyError,
  backoff,
  validateContent,
  eventCampaignBlockReason,
  type TemplateShape,
} from "./rules";
import {
  graph,
  integrationConfig,
  buildPayload,
  uploadMetaMedia,
  MetaRequestError,
  syncIntegration,
  json,
} from "./meta";
import { transaction, audit, eligibility } from "./service";

async function pauseIntegration(
  org: string,
  reason: string,
  until: Date | null = null,
) {
  await transaction(async (tx) => {
    await tx.waIntegration.update({
      where: { organizationId: org },
      data: { blockedReason: reason, blockedUntil: until },
    });
    await tx.waCampaign.updateMany({
      where: {
        organizationId: org,
        status: { in: ["queued", "scheduled", "sending"] },
      },
      data: { status: "paused", pauseReason: reason },
    });
    await audit(tx, org, "worker", "CIRCUIT_OPENED", null, { reason, until });
  });
}
export async function claimJob(now = new Date(), campaignId?: string) {
  return transaction(async (tx) => {
    // One queue controller per phone/WABA/portfolio. Sorted locks avoid cross-campaign deadlocks.
    const candidates = await tx.waCampaign.findMany({
      where: {
        ...(campaignId ? { id: campaignId } : {}),
        status: { in: ["queued", "scheduled", "sending"] },
        nextDispatchAt: { lte: now },
      },
      orderBy: [{ nextDispatchAt: "asc" }, { createdAt: "asc" }],
      take: 20,
    });
    for (const campaign of candidates) {
      const integration = await tx.waIntegration.findUnique({
        where: { organizationId: campaign.organizationId },
      });
      if (
        !integration ||
        integration.blockedReason ||
        !integration.syncedAt ||
        now.getTime() - integration.syncedAt.getTime() > 15 * 60000
      )
        continue;
      const keys = [
        `waba:${integration.wabaId}`,
        `phone:${integration.phoneNumberId}`,
        ...(integration.portfolioId
          ? [`portfolio:${integration.portfolioId}`]
          : []),
      ].sort();
      for (const key of keys) {
        await tx.waRateGate.upsert({
          where: { key },
          create: { key, nextAt: now },
          update: {},
        });
        await tx.$queryRaw`SELECT key FROM "WaRateGate" WHERE key=${key} FOR UPDATE`;
      }
      const gates = await tx.waRateGate.findMany({
        where: { key: { in: keys } },
      });
      if (
        gates.some(
          (g) => g.nextAt > now || (g.blockedUntil && g.blockedUntil > now),
        )
      )
        continue;
      await tx.$queryRaw`SELECT id FROM "WaCampaign" WHERE id=${campaign.id} FOR UPDATE`;
      const current = await tx.waCampaign.findUniqueOrThrow({
        where: { id: campaign.id },
      });
      if (!["queued", "scheduled", "sending"].includes(current.status))
        continue;
      const job = await tx.waMessageJob.findFirst({
        where: {
          campaignId: campaign.id,
          state: { in: ["queued", "deferred"] },
          availableAt: { lte: now },
          uncertain: false,
        },
        orderBy: { createdAt: "asc" },
        include: { contact: true },
      });
      if (!job) {
        const left = await tx.waMessageJob.count({
          where: {
            campaignId: campaign.id,
            state: { in: ["queued", "deferred", "sending"] },
          },
        });
        if (!left) {
          await tx.waCampaign.update({
            where: { id: campaign.id },
            data: { status: "completed", completedAt: now },
          });
          await audit(
            tx,
            campaign.organizationId,
            "worker",
            "CAMPAIGN_COMPLETED",
            campaign.id,
          );
        }
        continue;
      }
      await tx.$queryRaw`SELECT id FROM "WaContact" WHERE id=${job.contactId} FOR UPDATE`;
      const contact = await tx.waContact.findUniqueOrThrow({
        where: { id: job.contactId },
      });
      const snapshot = current.snapshot as any;
      const config = configSchema.parse(snapshot.config);
      if (config.eventId) {
        const event = await tx.event.findFirst({
          where: {
            id: config.eventId,
            organizationId: campaign.organizationId,
          },
          select: { status: true, startsAt: true, endsAt: true },
        });
        const blocked = eventCampaignBlockReason(event, now);
        if (blocked) {
          await tx.waCampaign.update({
            where: { id: current.id },
            data: { status: "paused", pauseReason: blocked },
          });
          await audit(
            tx,
            campaign.organizationId,
            "worker",
            "CAMPAIGN_PAUSED_EVENT",
            current.id,
            { reason: blocked, eventId: config.eventId },
          );
          continue;
        }
      }
      const suppression = await tx.waSuppression.findUnique({
        where: {
          organizationId_phone: {
            organizationId: job.organizationId,
            phone: job.phone,
          },
        },
      });
      const ownReservation =
        job.reservedAt &&
        contact.lastReservedAt?.getTime() === job.reservedAt.getTime();
      const why = eligibility(
        {
          ...contact,
          lastMarketingAt: ownReservation
            ? null
            : (contact.lastReservedAt ?? contact.lastMarketingAt),
          cooldownUntil: ownReservation ? null : contact.cooldownUntil,
        },
        config,
        Boolean(suppression),
        integration.frequencyHours,
        now,
      );
      if (why) {
        await tx.waMessageJob.update({
          where: { id: job.id },
          data: { state: "cancelled", errorMessage: why },
        });
        continue;
      }
      const template = config.templateId
        ? await tx.waTemplate.findUnique({ where: { id: config.templateId } })
        : null;
      try {
        validateContent(config, template);
        if (
          template &&
          JSON.stringify(template.components) !==
            JSON.stringify(snapshot.template.components)
        )
          throw new Error("O template aprovado mudou depois da confirmação.");
      } catch (e) {
        const reason = e instanceof Error ? e.message : "Template indisponível";
        await tx.waCampaign.update({
          where: { id: current.id },
          data: { status: "paused", pauseReason: reason },
        });
        await audit(
          tx,
          job.organizationId,
          "worker",
          "CAMPAIGN_PAUSED",
          current.id,
          { reason },
        );
        continue;
      }
      // Claim persisted before the HTTP boundary; a crashed/ambiguous send is NEVER automatically replayed.
      const attemptId = randomUUID();
      await tx.waMessageJob.update({
        where: { id: job.id },
        data: {
          state: "sending",
          attemptId,
          reservedAt: job.reservedAt ?? now,
          dispatchStartedAt: now,
          attempts: { increment: 1 },
          errorCode: null,
          errorMessage: null,
        },
      });
      const ordinal = current.dispatchedCount + 1;
      const delay = paceDelay(config, ordinal, integration.minimumIntervalMs);
      const gateLeaseUntil = new Date(now.getTime() + 120000);
      await tx.waRateGate.updateMany({
        where: { key: { in: keys } },
        data: {
          nextAt: gateLeaseUntil,
        },
      });
      await tx.waCampaign.update({
        where: { id: current.id },
        data: {
          status: "sending",
          startedAt: current.startedAt ?? now,
          nextDispatchAt: new Date(now.getTime() + delay),
          dispatchedCount: { increment: 1 },
        },
      });
      if (!current.startedAt)
        await audit(
          tx,
          job.organizationId,
          "worker",
          "CAMPAIGN_STARTED",
          current.id,
        );
      if (config.purpose === "marketing" && !job.reservedAt)
        await tx.waContact.update({
          where: { id: contact.id },
          data: {
            lastReservedAt: now,
            unengagedCount: { increment: 1 },
            ...(contact.unengagedCount + 1 >= integration.disengagedAfter
              ? {
                  cooldownUntil: new Date(
                    now.getTime() + integration.cooldownDays * 86400000,
                  ),
                }
              : {}),
          },
        });
      return {
        ...job,
        attemptId,
        gateKeys: keys,
        gateLeaseUntil,
        paceMs: delay,
        attempts: job.attempts + 1,
        config,
        template: snapshot.template as TemplateShape | null,
        snapshot,
        integration,
      };
    }
    return null;
  });
}
export async function processOne(campaignId?: string) {
  const job = await claimJob(new Date(), campaignId);
  if (!job) return false;
  let requestStarted = false;
  try {
    const current = await prisma.waCampaign.findUniqueOrThrow({
      where: { id: job.campaignId },
    });
    const contact = await prisma.waContact.findUniqueOrThrow({
      where: { id: job.contactId },
    });
    const suppressed = await prisma.waSuppression.findUnique({
      where: {
        organizationId_phone: {
          organizationId: job.organizationId,
          phone: job.phone,
        },
      },
    });
    if (
      !["sending", "queued"].includes(current.status) ||
      suppressed ||
      contact.optInStatus === "opt_out"
    ) {
      await prisma.waMessageJob.update({
        where: { id: job.id },
        data: {
          state: current.status === "paused" ? "deferred" : "cancelled",
          dispatchStartedAt: null,
          errorMessage: "Envio interrompido antes da API",
        },
      });
      return true;
    }
    let mediaId: string | undefined;
    if (job.config.kind !== "text") {
      const media = await prisma.waMedia.findFirstOrThrow({
        where: {
          id: job.config.mediaId,
          organizationId: job.organizationId,
          ready: true,
        },
      });
      mediaId = await uploadMetaMedia(job.organizationId, media);
    }
    const c = await integrationConfig(job.organizationId);
    if (
      c.phone !== job.integration.phoneNumberId ||
      c.waba !== job.integration.wabaId
    )
      throw new Error("Identidade da integração alterada.");
    const tracked = job.config.trackClicks
      ? `${process.env.WHATSAPP_CAMPAIGN_PUBLIC_URL?.replace(/\/$/, "")}/r/whatsapp/${job.clickToken}`
      : undefined;
    const payload = buildPayload(
      job.config,
      job.template,
      { name: (job.recipient as any).name, phone: job.phone },
      job.attemptId,
      mediaId,
      tracked,
    );
    const [gateCampaign, gateContact, gateSuppression, gateIntegration] =
      await Promise.all([
        prisma.waCampaign.findUniqueOrThrow({ where: { id: job.campaignId } }),
        prisma.waContact.findUniqueOrThrow({ where: { id: job.contactId } }),
        prisma.waSuppression.findUnique({
          where: {
            organizationId_phone: {
              organizationId: job.organizationId,
              phone: job.phone,
            },
          },
        }),
        prisma.waIntegration.findUniqueOrThrow({
          where: { organizationId: job.organizationId },
        }),
      ]);
    if (job.config.eventId) {
      const event = await prisma.event.findFirst({
        where: {
          id: job.config.eventId,
          organizationId: job.organizationId,
        },
        select: { status: true, startsAt: true, endsAt: true },
      });
      const blocked = eventCampaignBlockReason(event);
      if (blocked) {
        await pauseIntegration(job.organizationId, blocked);
        await prisma.waMessageJob.update({
          where: { id: job.id },
          data: {
            state: "deferred",
            dispatchStartedAt: null,
            errorMessage: blocked,
          },
        });
        return true;
      }
    }
    const closedWindow =
      !job.config.templateId &&
      (!gateContact.lastInboundAt ||
        Date.now() - gateContact.lastInboundAt.getTime() >= 86400000);
    if (
      !["sending", "queued"].includes(gateCampaign.status) ||
      gateSuppression ||
      gateContact.optInStatus !== "opt_in" ||
      gateIntegration.blockedReason ||
      closedWindow
    ) {
      await prisma.waMessageJob.update({
        where: { id: job.id },
        data: {
          state: gateCampaign.status === "paused" ? "deferred" : "cancelled",
          dispatchStartedAt: null,
          errorMessage: "Envio impedido pela revalidação final",
        },
      });
      return true;
    }
    if (job.config.templateId) {
      const fresh = await prisma.waTemplate.findUnique({
        where: { id: job.config.templateId },
      });
      validateContent(job.config, fresh);
      if (
        JSON.stringify(fresh?.components) !==
        JSON.stringify(job.template?.components)
      )
        throw new Error("Template alterado após confirmação.");
    }
    if (Date.now() + 25000 >= job.gateLeaseUntil.getTime())
      throw new Error(
        "Preparação excedeu a reserva de envio; revalide antes de retomar.",
      );
    // Pace from the actual provider attempt, after potentially slow media preparation.
    await prisma.waCampaign.update({
      where: { id: job.campaignId },
      data: { nextDispatchAt: new Date(Date.now() + job.paceMs) },
    });
    requestStarted = true;
    const response = await graph(job.organizationId, `${c.phone}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const messageId = response.messages?.[0]?.id;
    if (!messageId)
      throw new MetaRequestError(
        0,
        200,
        "A Meta não confirmou o identificador da mensagem.",
        true,
      );
    // HTTP acceptance is not a sent/delivered receipt. Those timestamps belong to webhooks.
    await transaction(async (tx) => {
      await tx.waMessageJob.update({
        where: { id: job.id },
        data: {
          providerMessageId: messageId,
          acceptedAt: new Date(),
          uncertain: false,
        },
      });
      if (job.config.purpose === "marketing")
        await tx.waContact.update({
          where: { id: job.contactId },
          data: { lastMarketingAt: new Date() },
        });
      await tx.waIntegration.update({
        where: { organizationId: job.organizationId },
        data: { consecutiveErrors: 0 },
      });
      await audit(
        tx,
        job.organizationId,
        "worker",
        "MESSAGE_ACCEPTED",
        job.campaignId,
        { jobId: job.id, messageId },
      );
    });
  } catch (error) {
    const ambiguous =
      requestStarted &&
      (!(error instanceof MetaRequestError) || error.ambiguous);
    const code = error instanceof MetaRequestError ? error.code : 0;
    const http = error instanceof MetaRequestError ? error.httpStatus : 0;
    const action = classifyError(code, http);
    const message = (
      error instanceof Error ? error.message : "Falha no envio"
    ).slice(0, 800);
    if (ambiguous) {
      await prisma.waMessageJob.updateMany({
        where: {
          id: job.id,
          providerMessageId: null,
          sentAt: null,
          deliveredAt: null,
          readAt: null,
        },
        data: {
          state: "deferred",
          uncertain: true,
          errorCode: "UNCERTAIN",
          errorMessage:
            "Envio sem confirmação. Aguardando webhook; não será reenviado automaticamente.",
        },
      });
      await pauseIntegration(
        job.organizationId,
        "Há um envio sem confirmação da Meta. Aguarde a conciliação pelo webhook.",
      );
    } else {
      const retry = ["transient", "rate"].includes(action) && job.attempts < 5;
      const delay = backoff(job.attempts);
      await transaction(async (tx) => {
        await tx.waMessageJob.update({
          where: { id: job.id },
          data: {
            state: retry ? "deferred" : "failed",
            availableAt: new Date(Date.now() + delay),
            errorCode: String(code),
            errorMessage: message,
            ...(!retry ? { failedAt: new Date() } : {}),
            dispatchStartedAt: null,
          },
        });
        const integration = await tx.waIntegration.update({
          where: { organizationId: job.organizationId },
          data: {
            consecutiveErrors: { increment: 1 },
            ...(action === "rate"
              ? {
                  minimumIntervalMs: Math.min(
                    60000,
                    job.integration.minimumIntervalMs * 2,
                  ),
                }
              : {}),
          },
        });
        if (action === "recipient_limit" || action === "permanent")
          await tx.waContact.update({
            where: { id: job.contactId },
            data: {
              cooldownUntil: new Date(
                Date.now() + integration.cooldownDays * 86400000,
              ),
            },
          });
        await audit(
          tx,
          job.organizationId,
          "worker",
          "MESSAGE_ERROR",
          job.campaignId,
          { jobId: job.id, code, action, retry },
        );
      });
      if (
        action === "pause" ||
        action === "rate" ||
        action === "transient" ||
        !requestStarted
      )
        await pauseIntegration(
          job.organizationId,
          message,
          action === "rate" || action === "transient"
            ? new Date(Date.now() + delay)
            : null,
        );
      const health = await prisma.waIntegration.findUnique({
        where: { organizationId: job.organizationId },
      });
      if ((health?.consecutiveErrors ?? 0) >= 5)
        await pauseIntegration(
          job.organizationId,
          "Sequência de falhas. Revise a integração e os destinatários.",
        );
    }
  } finally {
    // Compare the reservation before releasing: never overwrite a newer worker lease.
    await prisma.waRateGate.updateMany({
      where: { key: { in: job.gateKeys }, nextAt: job.gateLeaseUntil },
      data: {
        nextAt: new Date(Date.now() + job.integration.minimumIntervalMs),
      },
    });
  }
  return true;
}
export async function recoverTemporaryPause(organizationId: string) {
  // Sync first; a successful request alone does not prove the phone is healthy.
  const synced = await syncIntegration(organizationId, "worker");
  const health = synced.health as Record<string, unknown>;
  if (
    health.quality_rating === "RED" ||
    (health.status &&
      !["CONNECTED", "VERIFIED"].includes(String(health.status)))
  )
    return;
  await transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "WaIntegration" WHERE "organizationId"=${organizationId} FOR UPDATE`;
    const current = await tx.waIntegration.findUniqueOrThrow({
      where: { organizationId },
    });
    if (
      !current.blockedReason ||
      !current.blockedUntil ||
      current.blockedUntil > new Date() ||
      current.consecutiveErrors >= 5
    )
      return;
    if (
      await tx.waMessageJob.count({
        where: { organizationId, uncertain: true },
      })
    )
      return;
    await tx.waCampaign.updateMany({
      where: {
        organizationId,
        status: "paused",
        pauseReason: current.blockedReason,
      },
      data: { status: "queued", pauseReason: null },
    });
    await tx.waIntegration.update({
      where: { organizationId },
      data: { blockedReason: null, blockedUntil: null },
    });
    await audit(tx, organizationId, "worker", "CIRCUIT_RECOVERED", null, {});
  });
}
export async function workerTick(budgetMs = 45000) {
  const start = Date.now();
  // An expired in-flight claim can mean Meta accepted it before the process crashed.
  const stale = await prisma.waMessageJob.findMany({
    where: {
      state: "sending",
      acceptedAt: null,
      dispatchStartedAt: { lt: new Date(Date.now() - 120000) },
    },
  });
  for (const job of stale) {
    await prisma.waMessageJob.updateMany({
      where: { id: job.id, state: "sending", acceptedAt: null },
      data: {
        state: "deferred",
        uncertain: true,
        errorCode: "UNCERTAIN",
        errorMessage:
          "Worker interrompido durante envio; aguardando confirmação da Meta.",
      },
    });
    await pauseIntegration(
      job.organizationId,
      "Envio interrompido sem confirmação. Não reenviar automaticamente.",
    );
  }
  const integrations = await prisma.waIntegration.findMany();
  for (const i of integrations) {
    if (Date.now() - start > budgetMs - 20000) break;
    if (
      i.blockedUntil &&
      i.blockedUntil <= new Date() &&
      i.consecutiveErrors < 5
    ) {
      try {
        await recoverTemporaryPause(i.organizationId);
      } catch {
        /* Keep the circuit closed to sends until health can be verified. */
      }
      continue;
    }
    if (!i.syncedAt || Date.now() - i.syncedAt.getTime() > 5 * 60000) {
      try {
        await syncIntegration(i.organizationId, "worker");
      } catch {
        await pauseIntegration(
          i.organizationId,
          "Não foi possível atualizar a saúde da integração Meta.",
        );
      }
    }
  }
  let processed = 0;
  while (Date.now() - start < budgetMs - 20000) {
    if (await processOne()) processed++;
    else await new Promise((r) => setTimeout(r, 500));
  }
  return { processed, durationMs: Date.now() - start };
}
