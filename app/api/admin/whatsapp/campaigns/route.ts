import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { campaignAdmin } from "@/features/whatsapp/campaigns/auth";
import {
  createDraft,
  saveDraft,
  confirmCampaign,
  controlCampaign,
  campaignReport,
  audienceSummary,
  metrics,
  CampaignConflict,
  audit,
  transaction,
} from "@/features/whatsapp/campaigns/service";
import {
  configSchema,
  normalizePhone,
} from "@/features/whatsapp/campaigns/rules";
import {
  submitTemplate,
  syncIntegration,
} from "@/features/whatsapp/campaigns/meta";
import { importList } from "@/features/whatsapp/campaigns/import";
import { beginUpload } from "@/features/whatsapp/campaigns/media";
import { processOne } from "@/features/whatsapp/campaigns/worker";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const id = z.string().min(1).max(200);
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), key: z.uuid() }).strict(),
  z
    .object({
      operation: z.literal("save"),
      id,
      version: z.number().int().positive(),
      config: configSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("confirm"),
      id,
      version: z.number().int().positive(),
    })
    .strict(),
  z.object({ operation: z.enum(["pause", "resume", "cancel"]), id }).strict(),
  z.object({ operation: z.literal("dispatchNow"), id }).strict(),
  z.object({ operation: z.literal("audience"), config: configSchema }).strict(),
  z
    .object({
      operation: z.literal("sync"),
      release: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      operation: z.literal("submitTemplate"),
      name: z.string().regex(/^[a-z0-9_]{1,512}$/),
      language: z.literal("pt_BR"),
      category: z.literal("MARKETING"),
      body: z.string().min(1).max(1024),
      buttonText: z.string().min(1).max(25),
      buttonUrl: z.url(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("beginUpload"),
      name: z.string(),
      mime: z.string(),
      size: z.number(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("import"),
      uploadId: id,
      name: z.string().min(1).max(160),
      country: z.string().length(2).default("BR"),
    })
    .strict(),
  z
    .object({
      operation: z.literal("settings"),
      frequencyHours: z.number().int().min(1).max(8760),
      cooldownDays: z.number().int().min(1).max(365),
      disengagedAfter: z.number().int().min(1).max(50),
      minimumIntervalMs: z.number().int().min(1000).max(3600000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("suppress"),
      phone: z.string(),
      reason: z.string().min(5).max(500),
    })
    .strict(),
]);
function failure(error: unknown) {
  if (error instanceof CampaignConflict)
    return response({ error: error.message, conflict: true }, 409);
  if (error instanceof z.ZodError)
    return response(
      { error: error.issues.map((i) => i.message).join("; ") },
      400,
    );
  if (error instanceof Error && error.message === "FORBIDDEN")
    return response(
      {
        error:
          "Acesso restrito à equipe de marketing com acesso a todos os eventos.",
      },
      403,
    );
  if (
    error instanceof Error &&
    error.name !== "PrismaClientKnownRequestError" &&
    error.name !== "PrismaClientUnknownRequestError"
  )
    return response({ error: error.message }, 400);
  return response(
    { error: "Não foi possível concluir a operação. Tente novamente." },
    500,
  );
}
export async function GET(request: Request) {
  try {
    const admin = await campaignAdmin();
    const org = admin.organizationId;
    const url = new URL(request.url),
      campaignId = url.searchParams.get("id");
    if (campaignId) return response(await campaignReport(org, campaignId));
    const mediaId = url.searchParams.get("mediaId");
    if (mediaId)
      return response(
        await prisma.waMedia.findFirstOrThrow({
          where: { id: mediaId, organizationId: org, ready: true },
          select: {
            id: true,
            name: true,
            mime: true,
            size: true,
            metadata: true,
          },
        }),
      );
    const from = z.iso
      .date()
      .parse(
        url.searchParams.get("from") ??
          new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      );
    const to = z.iso
      .date()
      .parse(
        url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10),
      );
    const start = new Date(`${from}T00:00:00-03:00`),
      end = new Date(`${to}T23:59:59.999-03:00`);
    if (start > end) throw new Error("Período inválido.");
    const [campaigns, lists, templates, integration, events, users] =
      await Promise.all([
        prisma.waCampaign.findMany({
          where: {
            organizationId: org,
            OR: [
              { startedAt: { gte: start, lte: end } },
              { startedAt: null, createdAt: { gte: start, lte: end } },
              {
                jobs: {
                  some: {
                    OR: [
                      { sentAt: { gte: start, lte: end } },
                      { deliveredAt: { gte: start, lte: end } },
                      { readAt: { gte: start, lte: end } },
                      { repliedAt: { gte: start, lte: end } },
                    ],
                  },
                },
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          include: {
            jobs: {
              select: {
                state: true,
                sentAt: true,
                deliveredAt: true,
                readAt: true,
                repliedAt: true,
                optedOutAt: true,
                clickedAt: true,
                acceptedAt: true,
              },
            },
          },
        }),
        prisma.waContactList.findMany({
          where: { organizationId: org },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
        prisma.waTemplate.findMany({
          where: { organizationId: org },
          orderBy: { name: "asc" },
        }),
        prisma.waIntegration.findUnique({ where: { organizationId: org } }),
        prisma.event.findMany({
          where: {
            organizationId: org,
            status: "PUBLISHED",
            OR: [
              { endsAt: { gte: new Date() } },
              { endsAt: null, startsAt: { gte: new Date() } },
            ],
          },
          select: { id: true, title: true },
          orderBy: { startsAt: "desc" },
        }),
        prisma.adminUser.findMany({
          where: { organizationId: org, isActive: true },
          select: { id: true, name: true },
        }),
      ]);
    const jobs = campaigns.flatMap((c) => c.jobs);
    const inPeriod = (at: Date | null) => !!at && at >= start && at <= end;
    // Delivery percentage uses the sent cohort; late replies never inflate sent counts.
    const periodMetrics = metrics(
      jobs.filter((j) => inPeriod(j.sentAt ?? j.deliveredAt ?? j.readAt)),
    );
    return response({
      trackingBaseUrl:
        process.env.WHATSAPP_CAMPAIGN_PUBLIC_URL?.replace(/\/$/, "") ?? null,
      campaigns: campaigns.map(({ jobs, ...c }) => ({
        ...c,
        metrics: metrics(jobs),
      })),
      lists,
      templates,
      integration,
      events,
      users,
      adminId: admin.id,
      metrics: {
        ...periodMetrics,
        replies: jobs.filter((j) => inPeriod(j.repliedAt)).length,
        active: campaigns.filter((c) =>
          ["queued", "scheduled", "sending"].includes(c.status),
        ).length,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const admin = await campaignAdmin(request),
      org = admin.organizationId;
    const input = schema.parse(await request.json());
    let result: unknown;
    switch (input.operation) {
      case "create":
        result = await createDraft(org, admin.id, input.key);
        break;
      case "save":
        result = await saveDraft(
          org,
          admin.id,
          input.id,
          input.version,
          input.config,
        );
        break;
      case "confirm":
        result = await confirmCampaign(org, admin.id, input.id, input.version);
        break;
      case "pause":
      case "resume":
      case "cancel":
        result = await controlCampaign(
          org,
          admin.id,
          input.id,
          input.operation,
        );
        break;
      case "dispatchNow": {
        if (admin.role !== "OWNER" && admin.role !== "MANAGER")
          throw new Error("FORBIDDEN");
        const campaign = await prisma.waCampaign.findFirstOrThrow({
          where: { id: input.id, organizationId: org },
          select: { id: true, status: true },
        });
        if (!["queued", "scheduled", "sending"].includes(campaign.status))
          throw new Error(
            "A campanha precisa estar na fila para o envio imediato.",
          );
        await syncIntegration(org, admin.id);
        const integration = await prisma.waIntegration.findUniqueOrThrow({
          where: { organizationId: org },
        });
        const health = integration.health as Record<string, unknown>;
        if (
          health.quality_rating === "RED" ||
          (health.status &&
            !["CONNECTED", "VERIFIED"].includes(
              String(health.status),
            )) ||
          (integration.blockedUntil && integration.blockedUntil > new Date())
        )
          throw new Error("A integração ainda está restrita ou em backoff.");
        await transaction(async (tx) => {
          await tx.waIntegration.update({
            where: { organizationId: org },
            data: {
              blockedReason: null,
              blockedUntil: null,
              consecutiveErrors: 0,
            },
          });
          await audit(tx, org, admin.id, "ADMIN_DISPATCH_REQUESTED", input.id);
        });
        result = { processed: await processOne(input.id) };
        break;
      }
      case "audience":
        result = await audienceSummary(org, input.config);
        break;
      case "sync": {
        result = await syncIntegration(org, admin.id);
        if (input.release) {
          if (admin.role !== "OWNER" && admin.role !== "MANAGER")
            throw new Error("FORBIDDEN");
          const i = await prisma.waIntegration.findUniqueOrThrow({
            where: { organizationId: org },
          });
          const health = i.health as any;
          if (
            health.quality_rating === "RED" ||
            (health.status &&
              !["CONNECTED", "VERIFIED"].includes(health.status)) ||
            (i.blockedUntil && i.blockedUntil > new Date())
          )
            throw new Error("A integração ainda está restrita ou em backoff.");
          if (
            await prisma.waMessageJob.count({
              where: { organizationId: org, uncertain: true },
            })
          )
            throw new Error(
              "Ainda há envios sem confirmação; aguarde os webhooks.",
            );
          await transaction(async (tx) => {
            await tx.waIntegration.update({
              where: { organizationId: org },
              data: {
                blockedReason: null,
                blockedUntil: null,
                consecutiveErrors: 0,
              },
            });
            await audit(tx, org, admin.id, "INTEGRATION_RELEASED", null);
          });
        }
        break;
      }
      case "submitTemplate": {
        if (!["OWNER", "MANAGER"].includes(admin.role))
          throw new Error("FORBIDDEN");
        const { operation, ...template } = input;
        result = await submitTemplate(org, admin.id, template);
        break;
      }
      case "beginUpload":
        result = await beginUpload(
          org,
          admin.id,
          input.name,
          input.mime,
          input.size,
        );
        break;
      case "import": {
        const upload = await prisma.waMedia.findFirstOrThrow({
          where: {
            id: input.uploadId,
            organizationId: org,
            createdBy: admin.id,
            ready: true,
          },
        });
        if ((upload.metadata as any).kind !== "list")
          throw new Error("Selecione uma lista CSV ou XLSX.");
        result = await importList(
          org,
          admin.id,
          input.name,
          Buffer.from(upload.data),
          upload.name,
          input.country,
        );
        break;
      }
      case "settings": {
        if (!["OWNER", "MANAGER"].includes(admin.role))
          throw new Error("FORBIDDEN");
        const { operation, ...settings } = input;
        result = await transaction(async (tx) => {
          const saved = await tx.waIntegration.update({
            where: { organizationId: org },
            data: settings,
          });
          await audit(tx, org, admin.id, "POLICY_UPDATED", null, settings);
          return saved;
        });
        break;
      }
      case "suppress": {
        const phone = normalizePhone(input.phone);
        if (!phone) throw new Error("Telefone inválido.");
        result = await transaction(async (tx) => {
          await tx.waContact.updateMany({
            where: { organizationId: org, phone },
            data: { optInStatus: "opt_out" },
          });
          const saved = await tx.waSuppression.upsert({
            where: { organizationId_phone: { organizationId: org, phone } },
            create: {
              organizationId: org,
              phone,
              reason: input.reason,
              source: admin.id,
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
            data: { state: "cancelled", errorMessage: "Contato descadastrado" },
          });
          await audit(tx, org, admin.id, "CONTACT_SUPPRESSED", null, {
            phone,
            reason: input.reason,
          });
          return saved;
        });
        break;
      }
    }
    return response({ result });
  } catch (e) {
    return failure(e);
  }
}
