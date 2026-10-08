import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  configSchema,
  personalize,
  parameterNames,
  templateParts,
  type TemplateShape,
  type CampaignConfig,
  validateContent,
} from "./rules";
export const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function integrationConfig(organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { slug: true },
  });
  const suffix = org.slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const env = (key: string) =>
    process.env[`${key}_${suffix}`]?.trim() ||
    (org.slug === "tcr-ingressos" ? process.env[key]?.trim() : undefined);
  const token = env("WHATSAPP_API_TOKEN"),
    phone = env("WHATSAPP_PHONE_NUMBER_ID"),
    waba = env("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    portfolio = env("WHATSAPP_BUSINESS_PORTFOLIO_ID"),
    version = env("WHATSAPP_GRAPH_API_VERSION") || "v23.0";
  if (
    !token ||
    !phone ||
    !waba ||
    !/^\d+$/.test(phone) ||
    !/^\d+$/.test(waba) ||
    !/^v\d+\.0$/.test(version)
  )
    throw new Error(
      "Integração WhatsApp incompleta. Configure token, número e WABA desta organização.",
    );
  return { token, phone, waba, portfolio, version };
}
export class MetaRequestError extends Error {
  constructor(
    public code: number,
    public httpStatus: number,
    message: string,
    public ambiguous = false,
  ) {
    super(message);
  }
}
export const META_HEALTH_SYNC_BLOCK =
  "Não foi possível atualizar a saúde da integração Meta.";

export function integrationBlockAfterSync(
  previousReason: string | null | undefined,
  currentReason: string | null,
) {
  if (currentReason)
    return { blockedReason: currentReason, blockedUntil: null };
  if (previousReason === META_HEALTH_SYNC_BLOCK)
    return { blockedReason: null, blockedUntil: null };
  return {};
}
export async function graph(
  organizationId: string,
  path: string,
  options: RequestInit = {},
) {
  const c = await integrationConfig(organizationId);
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${c.version}/${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${c.token}`, ...options.headers },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new MetaRequestError(
      0,
      0,
      "A conexão com a Meta foi interrompida.",
      options.method === "POST" && path.endsWith("/messages"),
    );
  }
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new MetaRequestError(
      0,
      response.status,
      "Resposta da Meta sem confirmação válida.",
      options.method === "POST" && path.endsWith("/messages"),
    );
  }
  if (!response.ok || data.error)
    throw new MetaRequestError(
      Number(data.error?.code ?? 0),
      response.status,
      String(data.error?.message ?? "Falha na API Meta").slice(0, 800),
    );
  return data;
}
export async function syncIntegration(organizationId: string, actorId: string) {
  const c = await integrationConfig(organizationId);
  const old = await prisma.waIntegration.findUnique({
    where: { organizationId },
  });
  if (old && (old.phoneNumberId !== c.phone || old.wabaId !== c.waba))
    throw new Error(
      "A identidade da integração mudou. Revise as campanhas antes de trocar o número.",
    );
  // Verify the configured number actually belongs to this WABA.
  const phones = await graph(
    organizationId,
    `${c.waba}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100`,
  );
  const phone = phones.data?.find((p: any) => p.id === c.phone);
  if (!phone)
    throw new Error("O número configurado não pertence à WABA informada.");
  let health: any = phone;
  try {
    health = {
      ...phone,
      ...(await graph(
        organizationId,
        `${c.phone}?fields=id,status,throughput,messaging_limit_tier`,
      )),
    };
  } catch {
    /* Optional fields vary by Graph version. Missing metrics stay unknown. */
  }
  const templates: any[] = [];
  let after = "";
  for (let page = 0; page < 100; page++) {
    const result = await graph(
      organizationId,
      `${c.waba}/message_templates?fields=id,name,language,status,category,components,quality_score&limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    );
    if (!Array.isArray(result.data))
      throw new Error("Sincronização incompleta de templates.");
    templates.push(...result.data);
    if (!result.paging?.next) break;
    const next = result.paging?.cursors?.after;
    if (!next || next === after || page === 99)
      throw new Error("Paginação inválida de templates.");
    after = next;
  }
  const reason =
    health.quality_rating === "RED"
      ? "Qualidade do número baixa na Meta."
      : health.status && !["CONNECTED", "VERIFIED"].includes(health.status)
        ? `Número: ${health.status}`
        : null;
  const now = new Date();
  return prisma.$transaction(
    async (tx) => {
      const integration = await tx.waIntegration.upsert({
        where: { organizationId },
        create: {
          organizationId,
          phoneNumberId: c.phone,
          wabaId: c.waba,
          portfolioId: c.portfolio,
          health: json(health),
          syncedAt: now,
          blockedReason: reason,
        },
        update: {
          health: json(health),
          syncedAt: now,
          ...integrationBlockAfterSync(old?.blockedReason, reason),
        },
      });
      for (const t of templates)
        await tx.waTemplate.upsert({
          where: { organizationId_metaId: { organizationId, metaId: t.id } },
          create: {
            organizationId,
            metaId: t.id,
            name: t.name,
            language: t.language,
            status: t.status,
            category: t.category,
            components: json(t.components ?? []),
            quality: t.quality_score?.score ?? null,
            syncedAt: now,
          },
          update: {
            name: t.name,
            language: t.language,
            status: t.status,
            category: t.category,
            components: json(t.components ?? []),
            quality: t.quality_score?.score ?? null,
            syncedAt: now,
          },
        });
      await tx.waTemplate.updateMany({
        where: { organizationId, syncedAt: { lt: now } },
        data: { status: "DISABLED" },
      });
      if (reason)
        await tx.waCampaign.updateMany({
          where: {
            organizationId,
            status: { in: ["sending", "queued", "scheduled"] },
          },
          data: { status: "paused", pauseReason: reason },
        });
      await tx.waAudit.create({
        data: {
          organizationId,
          actorId,
          action: "INTEGRATION_SYNCED",
          detail: { templates: templates.length },
        },
      });
      return integration;
    },
    { timeout: 30000 },
  );
}
export function buildPayload(
  c: CampaignConfig,
  t: TemplateShape | null,
  recipient: { name: string; phone: string },
  attemptId: string,
  mediaId?: string,
  trackedUrl?: string,
) {
  validateContent(c, t);
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient.phone.replace(/^\+/, ""),
    biz_opaque_callback_data: attemptId,
  };
  if (t) {
    const parts = templateParts(t);
    const components: any[] = [];
    const keys = parameterNames(parts.body);
    if (keys.length)
      components.push({
        type: "body",
        parameters: keys.map((key) => ({
          type: "text",
          text: personalize(c.variables[key], recipient, c.personalize),
          ...(/^\d+$/.test(key) ? {} : { parameter_name: key }),
        })),
      });
    if (c.kind !== "text") {
      if (!mediaId) throw new Error("Mídia ausente.");
      components.push({
        type: "header",
        parameters: [{ type: c.kind, [c.kind]: { id: mediaId } }],
      });
    }
    parts.buttons.forEach((b, index) => {
      if (b.type === "URL" && b.url?.includes("{{1}}")) {
        const prefix = b.url.replace(/\{\{1\}\}$/, "");
        const url = trackedUrl ?? c.ctaUrl;
        if (!url.startsWith(prefix))
          throw new Error(
            "O link rastreável não corresponde ao prefixo do template.",
          );
        components.push({
          type: "button",
          sub_type: "url",
          index: String(index),
          parameters: [{ type: "text", text: url.slice(prefix.length) }],
        });
      }
    });
    return {
      ...base,
      type: "template",
      template: { name: t.name, language: { code: t.language }, components },
    };
  }
  const body =
    personalize(c.message, recipient, c.personalize) +
    (c.ctaUrl ? `\n${c.ctaUrl}` : "");
  if (c.kind === "text")
    return { ...base, type: "text", text: { body, preview_url: true } };
  if (!mediaId) throw new Error("Mídia ausente.");
  return {
    ...base,
    type: c.kind,
    [c.kind]: {
      id: mediaId,
      ...(c.kind !== "audio" && body ? { caption: body } : {}),
    },
  };
}
const mediaCache = new Map<string, { id: string; expiresAt: number }>();
export async function uploadMetaMedia(
  organizationId: string,
  media: { id?: string; data: Uint8Array; name: string; mime: string },
) {
  const c = await integrationConfig(organizationId);
  // Validated media is immutable. Cache assets only; message submissions are never cached/replayed.
  const key = media.id ? `${organizationId}:${c.phone}:${media.id}` : null;
  const cached = key ? mediaCache.get(key) : undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.id;
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set(
    "file",
    new Blob([new Uint8Array(media.data)], { type: media.mime }),
    media.name,
  );
  const result = await graph(organizationId, `${c.phone}/media`, {
    method: "POST",
    body: form,
  });
  if (!result.id)
    throw new Error("A Meta não retornou o identificador da mídia.");
  if (key) {
    if (mediaCache.size >= 100)
      mediaCache.delete(mediaCache.keys().next().value!);
    mediaCache.set(key, {
      id: String(result.id),
      expiresAt: Date.now() + 86400000,
    });
  }
  return String(result.id);
}
export const parseConfig = (v: unknown) => configSchema.parse(v);
