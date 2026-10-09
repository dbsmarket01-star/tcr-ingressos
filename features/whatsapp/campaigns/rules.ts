import { z } from "zod";
import { DateTime } from "luxon";
import {
  parsePhoneNumberFromString,
  type CountryCode,
  isSupportedCountry,
} from "libphonenumber-js/max";
export const configSchema = z
  .object({
    name: z.string().max(160).default("Nova campanha"),
    eventId: z.string().default(""),
    category: z.string().max(100).default(""),
    objective: z.string().max(100).default("Divulgação"),
    responsibleId: z.string().default(""),
    notes: z.string().max(2000).default(""),
    listId: z.string().default(""),
    tag: z.string().max(100).default(""),
    city: z.string().max(100).default(""),
    contactStatus: z.enum(["", "active", "cooldown"]).default(""),
    scheduleMode: z.enum(["now", "scheduled"]).default("now"),
    date: z.string().default(""),
    time: z.string().default(""),
    timezone: z.string().default("America/Sao_Paulo"),
    pace: z.enum(["auto", "interval", "batch"]).default("auto"),
    intervalSeconds: z.number().int().min(1).max(3600).default(3),
    batchSize: z.number().int().min(1).max(1000).default(5),
    batchPeriodSeconds: z.number().int().min(1).max(86400).default(30),
    batchPauseSeconds: z.number().int().min(0).max(86400).default(90),
    canarySize: z.number().int().min(0).max(1000).default(10),
    kind: z.enum(["text", "image", "video", "audio"]).default("text"),
    message: z.string().max(4096).default(""),
    templateId: z.string().default(""),
    variables: z.record(z.string(), z.string().max(1024)).default({}),
    mediaId: z.string().default(""),
    ctaUrl: z
      .union([
        z.literal(""),
        z
          .url()
          .refine(
            (u) => new URL(u).protocol === "https:",
            "Use um link HTTPS.",
          ),
      ])
      .default(""),
    ctaLabel: z.string().max(25).default(""),
    personalize: z.boolean().default(true),
    trackClicks: z.boolean().default(false),
    purpose: z.enum(["marketing", "utility"]).default("marketing"),
    step: z.number().int().min(1).max(3).default(1),
  })
  .strict();
export type CampaignConfig = z.infer<typeof configSchema>;
export const initialConfig = configSchema.parse({});
export const stateLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  queued: "Na fila",
  sending: "Enviando",
  paused: "Pausada",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};
export type CampaignEventShape = {
  status: string;
  startsAt: Date;
  endsAt: Date | null;
};
export function eventCampaignBlockReason(
  event: CampaignEventShape | null,
  now = new Date(),
) {
  if (!event) return "Evento não encontrado para esta bilheteria.";
  if (event.status !== "PUBLISHED")
    return "Disparo bloqueado: o evento não está publicado.";
  if ((event.endsAt ?? event.startsAt).getTime() < now.getTime())
    return "Disparo bloqueado: o evento já terminou.";
  return null;
}
export function normalizePhone(value: unknown, country = "BR") {
  if (!isSupportedCountry(country)) return null;
  const raw = String(value ?? "").trim();
  if (!raw || /[a-z]/i.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  const normalized = raw.startsWith("+")
    ? raw
    : digits.startsWith("00")
      ? `+${digits.slice(2)}`
      : country === "BR" && digits.startsWith("55") && digits.length >= 12
        ? `+${digits}`
        : raw;
  const p = parsePhoneNumberFromString(normalized, country as CountryCode);
  return p?.isValid() ? p.number : null;
}
export function scheduledDate(c: CampaignConfig, now = new Date()) {
  if (c.scheduleMode === "now") return now;
  const date = DateTime.fromISO(`${c.date}T${c.time}`, { zone: c.timezone });
  if (
    !date.isValid ||
    date.toFormat("yyyy-MM-dd'T'HH:mm") !== `${c.date}T${c.time}` ||
    date.getPossibleOffsets().length !== 1
  )
    throw new Error("Data, horário ou fuso inválido/ambíguo.");
  if (date.toMillis() <= now.getTime())
    throw new Error("Escolha um horário futuro.");
  return date.toJSDate();
}
export function paceDelay(
  c: CampaignConfig,
  ordinal: number,
  minimumMs = 1000,
) {
  if (c.pace === "interval")
    return Math.max(minimumMs, c.intervalSeconds * 1000);
  if (c.pace === "batch")
    return (
      Math.max(minimumMs, (c.batchPeriodSeconds * 1000) / c.batchSize) +
      (ordinal % c.batchSize === 0 ? c.batchPauseSeconds * 1000 : 0)
    );
  return minimumMs;
}
export function estimateSeconds(
  c: CampaignConfig,
  count: number,
  minimumMs = 1000,
) {
  let ms = 0;
  for (let n = 1; n < count; n++) ms += paceDelay(c, n, minimumMs);
  return Math.ceil(ms / 1000);
}
export function isOptOut(text: string) {
  return /^(sair|parar|cancelar|remover|nao quero receber|descadastrar|stop|unsubscribe)(\s|[.!]|$)/.test(
    text
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
  );
}
export function classifyError(code: number, status = 400) {
  if ([190, 10, 200, 131031, 131042, 368, 131048, 130497].includes(code))
    return "pause" as const;
  if (code >= 132000 && code < 133000) return "pause" as const;
  if ([130429, 131056, 80007, 4].includes(code) || status === 429)
    return "rate" as const;
  if ([131049, 131050].includes(code)) return "recipient_limit" as const;
  if ([131026, 131030, 131051, 131047].includes(code))
    return "permanent" as const;
  if ([1, 2, 131000, 131016].includes(code) || status >= 500)
    return "transient" as const;
  return "permanent" as const;
}
export function backoff(attempt: number) {
  return Math.min(3600, 30 * 2 ** Math.min(attempt, 7)) * 1000;
}
export function normalizeOptIn(value: unknown) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["sim", "yes", "true", "1", "opt_in", "opt-in", "consented"].includes(
    v,
  )
    ? "opt_in"
    : ["opt_out", "opt-out", "sair", "revogado"].includes(v)
      ? "opt_out"
      : "unknown";
}
export type TemplateShape = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: unknown;
};
export type Component = {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string }>;
};
export function templateParts(t: TemplateShape) {
  const parts = t.components as Component[];
  return {
    body: parts.find((p) => p.type === "BODY")?.text ?? "",
    header: parts.find((p) => p.type === "HEADER"),
    footer: parts.find((p) => p.type === "FOOTER")?.text ?? "",
    buttons: parts.find((p) => p.type === "BUTTONS")?.buttons ?? [],
  };
}
export function parameterNames(text: string) {
  return [...new Set([...text.matchAll(/\{\{([\w]+)\}\}/g)].map((m) => m[1]))];
}
export function personalize(
  value: string,
  contact: { name: string },
  enabled = true,
) {
  return value.replace(/\{\{nome\}\}/g, enabled ? contact.name : "Olá");
}
export function renderedMessage(c: CampaignConfig, name = "Nome do contato") {
  return c.message.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    personalize(c.variables[key] ?? `{{${key}}}`, { name }, c.personalize),
  );
}
export function validateContent(c: CampaignConfig, t: TemplateShape | null) {
  if (c.templateId) {
    if (!t || t.status !== "APPROVED")
      throw new Error("Selecione um template aprovado e disponível.");
    if (t.category.toLowerCase() !== c.purpose)
      throw new Error(
        "A finalidade deve corresponder à categoria do template.",
      );
    const p = templateParts(t);
    if (c.message !== p.body)
      throw new Error(
        "O texto deve corresponder ao template aprovado. Personalize as variáveis.",
      );
    for (const key of parameterNames(p.body))
      if (!c.variables[key]?.trim())
        throw new Error(`Preencha a variável ${key}.`);
    if (c.kind === "audio")
      throw new Error(
        "Áudio livre exige janela de atendimento aberta; não é cabeçalho de template.",
      );
    const format = p.header?.format ?? "TEXT";
    if (["IMAGE", "VIDEO"].includes(format) && c.kind !== format.toLowerCase())
      throw new Error("Mídia incompatível com o cabeçalho aprovado.");
    if (
      !["IMAGE", "VIDEO", "TEXT"].includes(format) ||
      (format === "TEXT" && c.kind !== "text")
    )
      throw new Error("Formato do template incompatível com esta campanha.");
    if (parameterNames(p.header?.text ?? "").length)
      throw new Error(
        "Este template tem variáveis de cabeçalho não suportadas neste editor.",
      );
    if (
      p.buttons.some(
        (b) => !["URL", "QUICK_REPLY", "PHONE_NUMBER"].includes(b.type),
      )
    )
      throw new Error(
        "Este template contém um botão não suportado pelo editor.",
      );
    const urls = p.buttons.filter((b) => b.type === "URL");
    if (urls.length > 1)
      throw new Error("Selecione um template com um único CTA de URL.");
    const button = urls[0];
    if (button) {
      if (c.ctaLabel !== button.text)
        throw new Error("O texto do botão precisa ser igual ao aprovado.");
      const url = button.url ?? "",
        prefix = url.replace(/\{\{1\}\}$/, " ").trim();
      if (url.includes("{{1}}")) {
        if (!url.endsWith("{{1}}"))
          throw new Error("O botão dinâmico aprovado é inválido.");
        if (
          !c.trackClicks &&
          (!c.ctaUrl.startsWith(prefix) || c.ctaUrl.length <= prefix.length)
        )
          throw new Error("O link deve respeitar o prefixo do botão aprovado.");
      } else if (c.ctaUrl !== url)
        throw new Error("O link fixo deve ser igual ao aprovado.");
    } else if (c.ctaUrl || c.ctaLabel)
      throw new Error("O template selecionado não tem CTA de URL.");
  } else {
    if (["image", "video"].includes(c.kind) && c.message.length > 1024)
      throw new Error(
        "A legenda de imagem ou vídeo deve ter até 1.024 caracteres.",
      );
    if (c.trackClicks)
      throw new Error("Rastreamento exige um CTA de template compatível.");
    if (c.kind === "audio" && (c.message || c.ctaUrl))
      throw new Error(
        "Áudio livre não admite legenda ou botão; use somente o arquivo.",
      );
    if (c.ctaLabel) throw new Error("Texto de botão exige template aprovado.");
    if (c.kind === "text" && !c.message.trim())
      throw new Error("Escreva a mensagem.");
  }
  if (c.kind !== "text" && !c.mediaId)
    throw new Error("Anexe a mídia antes de continuar.");
}
