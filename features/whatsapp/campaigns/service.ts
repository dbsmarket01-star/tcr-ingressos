import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  configSchema,
  scheduledDate,
  validateContent,
  templateParts,
  eventCampaignBlockReason,
  type CampaignConfig,
} from "./rules";
import { json } from "./meta";
export type Tx = Prisma.TransactionClient;
export class CampaignConflict extends Error {
  constructor() {
    super(
      "Esta campanha foi alterada em outra aba. Recarregue a versão mais recente antes de continuar.",
    );
  }
}
export const audit = (
  tx: Tx,
  organizationId: string,
  actorId: string,
  action: string,
  campaignId: string | null,
  detail: unknown = {},
) =>
  tx.waAudit.create({
    data: { organizationId, actorId, action, campaignId, detail: json(detail) },
  });
export async function transaction<T>(fn: (tx: Tx) => Promise<T>) {
  for (let i = 0; ; i++)
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 30000,
        maxWait: 10000,
      });
    } catch (e) {
      if (
        i >= 3 ||
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== "P2034"
      )
        throw e;
    }
}
export async function createDraft(org: string, actor: string, key: string) {
  return transaction(async (tx) => {
    const existing = await tx.waCampaign.findUnique({
      where: {
        organizationId_creationKey: { organizationId: org, creationKey: key },
      },
    });
    if (existing) return existing;
    const row = await tx.waCampaign.create({
      data: {
        organizationId: org,
        creationKey: key,
        createdBy: actor,
        config: json(configSchema.parse({ responsibleId: actor })),
      },
    });
    await audit(tx, org, actor, "CAMPAIGN_CREATED", row.id);
    return row;
  });
}
export async function saveDraft(
  org: string,
  actor: string,
  id: string,
  version: number,
  raw: unknown,
) {
  const config = configSchema.parse(raw);
  return transaction(async (tx) => {
    if (config.eventId) {
      const event = await tx.event.findFirst({
        where: { id: config.eventId, organizationId: org },
        select: { status: true, startsAt: true, endsAt: true },
      });
      const blocked = eventCampaignBlockReason(event);
      if (blocked) throw new Error(blocked);
    }
    if (
      config.responsibleId &&
      !(await tx.adminUser.findFirst({
        where: {
          id: config.responsibleId,
          organizationId: org,
          isActive: true,
        },
      }))
    )
      throw new Error("Responsável não encontrado.");
    const updated = await tx.waCampaign.updateMany({
      where: { id, organizationId: org, status: "draft", version },
      data: {
        config: json(config),
        name: config.name,
        version: { increment: 1 },
      },
    });
    if (!updated.count) throw new CampaignConflict();
    await audit(tx, org, actor, "DRAFT_UPDATED", id, {
      version: version + 1,
      step: config.step,
    });
    return tx.waCampaign.findUniqueOrThrow({ where: { id } });
  });
}
export async function audience(tx: Tx, org: string, c: CampaignConfig) {
  const list = await tx.waContactList.findFirst({
    where: { id: c.listId, organizationId: org, status: "ready" },
    include: { members: { include: { contact: true } } },
  });
  if (!list) throw new Error("Selecione uma lista com importação concluída.");
  const members = list.members.filter((m) => {
    const s = m.snapshot as Record<string, string>;
    return (
      (!c.city || s.city === c.city) &&
      (!c.tag || s.tag === c.tag) &&
      (!c.contactStatus || m.contact.status === c.contactStatus)
    );
  });
  return { list, members };
}
export function eligibility(
  contact: {
    optInStatus: string;
    optInDate: Date | null;
    optInSource: string | null;
    purpose: string;
    cooldownUntil: Date | null;
    lastMarketingAt: Date | null;
    lastInboundAt: Date | null;
    status: string;
  },
  c: CampaignConfig,
  suppressed: boolean,
  frequencyHours: number,
  now: Date,
) {
  if (suppressed || contact.optInStatus === "opt_out") return "Descadastrado";
  if (
    contact.optInStatus !== "opt_in" ||
    !contact.optInDate ||
    !contact.optInSource ||
    contact.purpose !== c.purpose
  )
    return "Consentimento ausente ou incompatível";
  if (contact.cooldownUntil && contact.cooldownUntil > now)
    return "Período de descanso";
  if (
    c.purpose === "marketing" &&
    contact.lastMarketingAt &&
    now.getTime() - contact.lastMarketingAt.getTime() < frequencyHours * 3600000
  )
    return "Limite de frequência";
  if (
    !c.templateId &&
    (!contact.lastInboundAt ||
      now.getTime() - contact.lastInboundAt.getTime() >= 24 * 3600000)
  )
    return "Janela de atendimento encerrada";
  return null;
}
export async function audienceSummary(org: string, c: CampaignConfig) {
  return transaction(async (tx) => {
    const { list, members } = await audience(tx, org, c);
    const integration = await tx.waIntegration.findUnique({
      where: { organizationId: org },
    });
    const suppressed = new Set(
      (
        await tx.waSuppression.findMany({
          where: { organizationId: org },
          select: { phone: true },
        })
      ).map((s) => s.phone),
    );
    const reasons: Record<string, number> = {};
    let eligible = 0;
    for (const m of members) {
      const why = eligibility(
        m.contact,
        c,
        suppressed.has(m.contact.phone),
        integration?.frequencyHours ?? 72,
        new Date(),
      );
      if (why) reasons[why] = (reasons[why] ?? 0) + 1;
      else eligible++;
    }
    return {
      list: {
        id: list.id,
        name: list.name,
        version: list.version,
        source: list.source,
        createdAt: list.createdAt,
        originalCount: list.originalCount,
        validCount: list.validCount,
        invalidCount: list.invalidCount,
        duplicateCount: list.duplicateCount,
      },
      tags: [
        ...new Set(
          list.members.map((m) => (m.snapshot as any).tag).filter(Boolean),
        ),
      ],
      cities: [
        ...new Set(
          list.members.map((m) => (m.snapshot as any).city).filter(Boolean),
        ),
      ],
      total: members.length,
      eligible,
      reasons,
      contacts: members
        .slice(0, 30)
        .map((m) => ({
          name: m.contact.name,
          phone: m.contact.phone,
          lastMarketingAt: m.contact.lastMarketingAt,
          optInStatus: m.contact.optInStatus,
        })),
    };
  });
}
export async function confirmCampaign(
  org: string,
  actor: string,
  id: string,
  version: number,
) {
  return transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "WaCampaign" WHERE id=${id} AND "organizationId"=${org} FOR UPDATE`;
    const campaign = await tx.waCampaign.findFirstOrThrow({
      where: { id, organizationId: org },
    });
    if (campaign.confirmedAt) return campaign;
    if (campaign.version !== version || campaign.status !== "draft")
      throw new CampaignConflict();
    const c = configSchema.parse(campaign.config);
    if (!c.name.trim() || c.name === "Nova campanha")
      throw new Error("Informe um nome para a campanha.");
    if (c.eventId) {
      const event = await tx.event.findFirst({
        where: { id: c.eventId, organizationId: org },
        select: { status: true, startsAt: true, endsAt: true },
      });
      const blocked = eventCampaignBlockReason(event);
      if (blocked) throw new Error(blocked);
    }
    const integration = await tx.waIntegration.findUnique({
      where: { organizationId: org },
    });
    if (
      !integration?.syncedAt ||
      Date.now() - integration.syncedAt.getTime() > 15 * 60000
    )
      throw new Error("Sincronize a integração Meta antes de confirmar.");
    if (integration.blockedReason) throw new Error(integration.blockedReason);
    const template = c.templateId
      ? await tx.waTemplate.findFirst({
          where: { id: c.templateId, organizationId: org },
        })
      : null;
    validateContent(c, template);
    const media = c.mediaId
      ? await tx.waMedia.findFirst({
          where: { id: c.mediaId, organizationId: org, ready: true },
          select: {
            id: true,
            name: true,
            mime: true,
            size: true,
            metadata: true,
            sha256: true,
          },
        })
      : null;
    if (c.kind !== "text" && (!media || !media.mime.startsWith(c.kind + "/")))
      throw new Error("Mídia incompleta ou incompatível.");
    if (c.trackClicks) {
      const button =
        template &&
        templateParts(template).buttons.find((b) => b.type === "URL");
      const base = process.env.WHATSAPP_CAMPAIGN_PUBLIC_URL?.replace(/\/$/, "");
      if (!base || button?.url !== `${base}/r/whatsapp/{{1}}`)
        throw new Error(
          "Rastreamento exige template aprovado com a URL pública /r/whatsapp/{{1}}.",
        );
    }
    const { list, members } = await audience(tx, org, c);
    if (!members.length) throw new Error("A segmentação não contém contatos.");
    const suppressed = new Set(
      (
        await tx.waSuppression.findMany({
          where: { organizationId: org },
          select: { phone: true },
        })
      ).map((s) => s.phone),
    );
    const scheduledAt = scheduledDate(c);
    const snapshot = {
      config: c,
      list: {
        id: list.id,
        name: list.name,
        version: list.version,
        source: list.source,
      },
      template: template
        ? {
            id: template.id,
            name: template.name,
            language: template.language,
            status: template.status,
            category: template.category,
            components: template.components,
          }
        : null,
      media,
      phoneNumberId: integration.phoneNumberId,
      wabaId: integration.wabaId,
      confirmedAt: new Date().toISOString(),
      scheduledAt: scheduledAt.toISOString(),
    };
    const recipients = members.map((m) => {
      const reason = eligibility(
        m.contact,
        c,
        suppressed.has(m.contact.phone),
        integration.frequencyHours,
        new Date(),
      );
      return {
        organizationId: org,
        campaignId: id,
        contactId: m.contactId,
        phone: m.contact.phone,
        recipient: json({
          ...(m.snapshot as object),
          phone: m.contact.phone,
          name: (m.snapshot as any).name || m.contact.name,
          listVersion: list.version,
        }),
        state: reason ? "cancelled" : "queued",
        availableAt: scheduledAt,
        errorMessage: reason,
      };
    });
    if (!recipients.some((r) => r.state === "queued"))
      throw new Error(
        "Nenhum contato elegível. Confira consentimento, frequência e janela de atendimento.",
      );
    await tx.waMessageJob.createMany({
      data: recipients,
      skipDuplicates: true,
    });
    const updated = await tx.waCampaign.update({
      where: { id },
      data: {
        status: c.scheduleMode === "scheduled" ? "scheduled" : "queued",
        snapshot: json(snapshot),
        snapshotHash: createHash("sha256")
          .update(JSON.stringify(snapshot))
          .digest("hex"),
        listId: list.id,
        templateId: template?.id,
        phoneNumberId: integration.phoneNumberId,
        scheduledAt,
        nextDispatchAt: scheduledAt,
        confirmedAt: new Date(),
        confirmedBy: actor,
        version: { increment: 1 },
      },
    });
    await audit(tx, org, actor, "CAMPAIGN_CONFIRMED", id, {
      contacts: recipients.length,
      eligible: recipients.filter((r) => r.state === "queued").length,
      scheduledAt,
    });
    return updated;
  });
}
export async function controlCampaign(
  org: string,
  actor: string,
  id: string,
  operation: "pause" | "resume" | "cancel",
) {
  return transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "WaCampaign" WHERE id=${id} AND "organizationId"=${org} FOR UPDATE`;
    const row = await tx.waCampaign.findFirstOrThrow({
      where: { id, organizationId: org },
    });
    const allowed =
      operation === "resume"
        ? ["paused"]
        : ["queued", "scheduled", "sending", "paused"];
    if (!allowed.includes(row.status))
      throw new Error("Esta ação não está disponível no estado atual.");
    if (operation === "resume") {
      const integration = await tx.waIntegration.findUnique({
        where: { organizationId: org },
      });
      if (integration?.blockedReason)
        throw new Error(integration.blockedReason);
      if (
        await tx.waMessageJob.count({
          where: { campaignId: id, uncertain: true },
        })
      )
        throw new Error(
          "Há envios sem confirmação da Meta. Aguarde os webhooks antes de retomar.",
        );
    }
    if (operation === "cancel")
      await tx.waMessageJob.updateMany({
        where: {
          campaignId: id,
          state: { in: ["queued", "deferred"] },
          uncertain: false,
        },
        data: {
          state: "cancelled",
          errorMessage: "Campanha cancelada pelo operador",
        },
      });
    const result = await tx.waCampaign.update({
      where: { id },
      data: {
        status:
          operation === "pause"
            ? "paused"
            : operation === "cancel"
              ? "cancelled"
              : "queued",
        pauseReason: operation === "pause" ? "Pausada pelo operador" : null,
        ...(operation === "resume" ? { nextDispatchAt: new Date() } : {}),
        ...(operation === "cancel" ? { completedAt: new Date() } : {}),
        version: { increment: 1 },
      },
    });
    await audit(tx, org, actor, `CAMPAIGN_${operation.toUpperCase()}`, id);
    return result;
  });
}
export function metrics(
  jobs: Array<{
    state: string;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    repliedAt: Date | null;
    optedOutAt: Date | null;
    clickedAt: Date | null;
    acceptedAt: Date | null;
    errorMessage?: string | null;
  }>,
) {
  const count = (
    key:
      | "sentAt"
      | "deliveredAt"
      | "readAt"
      | "repliedAt"
      | "optedOutAt"
      | "clickedAt"
      | "acceptedAt",
  ) => jobs.filter((j) => j[key]).length;
  const sent = jobs.filter((j) => j.sentAt || j.deliveredAt || j.readAt).length,
    delivered = jobs.filter((j) => j.deliveredAt || j.readAt).length,
    read = count("readAt"),
    replies = count("repliedAt"),
    clicks = count("clickedAt"),
    totalClicks = jobs.reduce(
      (sum, job) => sum + Number((job as { clickCount?: number }).clickCount ?? 0),
      0,
    );
  const rate = (n: number, d: number) =>
    d ? Math.round((n / d) * 1000) / 10 : 0;
  const errors: Record<string, number> = {};
  for (const j of jobs.filter((j) => j.errorMessage))
    errors[j.errorMessage!] = (errors[j.errorMessage!] ?? 0) + 1;
  return {
    total: jobs.length,
    queued: jobs.filter((j) => ["queued", "deferred"].includes(j.state)).length,
    accepted: count("acceptedAt"),
    sent,
    delivered,
    read,
    replies,
    failed: jobs.filter((j) => j.state === "failed").length,
    cancelled: jobs.filter((j) => j.state === "cancelled").length,
    optOuts: count("optedOutAt"),
    clicks,
    totalClicks,
    deliveryRate: rate(delivered, sent),
    readRate: rate(read, delivered),
    replyRate: rate(replies, delivered),
    clickRate: rate(clicks, delivered),
    errors,
  };
}
export async function campaignReport(org: string, id: string) {
  const campaign = await prisma.waCampaign.findFirstOrThrow({
    where: { id, organizationId: org },
    include: { jobs: true },
  });
  const { jobs, ...row } = campaign;
  return {
    ...row,
    metrics: metrics(jobs),
    contacts: jobs.map((j) => ({
        id: j.id,
        phone: j.phone,
        name:
          typeof j.recipient === "object" && j.recipient
            ? String((j.recipient as { name?: unknown }).name ?? "")
            : "",
        state: j.state,
        uncertain: j.uncertain,
        errorCode: j.errorCode,
        error: j.errorMessage,
        acceptedAt: j.acceptedAt,
        sentAt: j.sentAt,
        deliveredAt: j.deliveredAt,
        readAt: j.readAt,
        repliedAt: j.repliedAt,
        clickedAt: j.clickedAt,
        clickCount: j.clickCount,
        optedOutAt: j.optedOutAt,
      })),
    audit: await prisma.waAudit.findMany({
      where: { organizationId: org, campaignId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  };
}
