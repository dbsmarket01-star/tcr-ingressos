import { describe, it, expect } from "vitest";
import {
  configSchema,
  normalizePhone,
  paceDelay,
  estimateSeconds,
  isOptOut,
  classifyError,
  scheduledDate,
  validateContent,
  eventCampaignBlockReason,
} from "@/features/whatsapp/campaigns/rules";
import { eligibility, metrics } from "@/features/whatsapp/campaigns/service";
import { buildPayload } from "@/features/whatsapp/campaigns/meta";
const now = new Date("2026-10-01T12:00:00Z");
const contact = {
  optInStatus: "opt_in",
  optInDate: new Date("2026-01-01"),
  optInSource: "formulario",
  purpose: "marketing",
  cooldownUntil: null,
  lastMarketingAt: null,
  lastInboundAt: now,
  status: "active",
};
const template = {
  id: "template",
  name: "convite",
  language: "pt_BR",
  status: "APPROVED",
  category: "MARKETING",
  components: [{ type: "BODY", text: "Olá {{1}}" }],
};
describe("WhatsApp campaign safety rules", () => {
  it("normalizes international and Brazilian numbers without fabricating invalid numbers", () => {
    expect(normalizePhone("(11) 98765-4321")).toBe("+5511987654321");
    expect(normalizePhone("5511987654321")).toBe("+5511987654321");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("abc11987654321")).toBeNull();
  });
  it.each([
    "SAIR",
    "PARAR",
    "CANCELAR",
    "REMOVER",
    "NÃO QUERO RECEBER",
    "Descadastrar",
  ])("recognizes opt-out %s", (text) => expect(isOptOut(text)).toBe(true));
  it("does not classify a regular greeting as opt-out", () =>
    expect(isOptOut("Olá, tudo bem?")).toBe(false));
  it("defaults to automatic pacing and enforces 1s to 1h", () => {
    expect(configSchema.parse({}).pace).toBe("auto");
    expect(() => configSchema.parse({ intervalSeconds: 0 })).toThrow();
    expect(() => configSchema.parse({ intervalSeconds: 3601 })).toThrow();
  });
  it("distributes batches and respects shared minimum capacity", () => {
    const c = configSchema.parse({
      pace: "batch",
      batchSize: 5,
      batchPeriodSeconds: 30,
      batchPauseSeconds: 90,
    });
    expect(paceDelay(c, 1)).toBe(6000);
    expect(paceDelay(c, 5)).toBe(96000);
    expect(estimateSeconds(c, 6)).toBe(120);
    expect(
      paceDelay(
        configSchema.parse({ pace: "interval", intervalSeconds: 1 }),
        1,
        3000,
      ),
    ).toBe(3000);
  });
  it("resolves a zoned schedule to UTC and rejects a past schedule", () => {
    expect(
      scheduledDate(
        configSchema.parse({
          scheduleMode: "scheduled",
          date: "2026-10-02",
          time: "16:00",
        }),
        now,
      ).toISOString(),
    ).toBe("2026-10-02T19:00:00.000Z");
    expect(() =>
      scheduledDate(
        configSchema.parse({
          scheduleMode: "scheduled",
          date: "2026-09-01",
          time: "16:00",
        }),
        now,
      ),
    ).toThrow();
  });
  it("blocks campaigns for missing, unpublished or finished events", () => {
    expect(eventCampaignBlockReason(null, now)).toContain("não encontrado");
    expect(
      eventCampaignBlockReason(
        { status: "UNPUBLISHED", startsAt: now, endsAt: null },
        now,
      ),
    ).toContain("não está publicado");
    expect(
      eventCampaignBlockReason(
        {
          status: "PUBLISHED",
          startsAt: new Date("2026-09-30T10:00:00Z"),
          endsAt: new Date("2026-09-30T12:00:00Z"),
        },
        now,
      ),
    ).toContain("já terminou");
    expect(
      eventCampaignBlockReason(
        {
          status: "PUBLISHED",
          startsAt: new Date("2026-10-02T10:00:00Z"),
          endsAt: null,
        },
        now,
      ),
    ).toBeNull();
  });
  it("blocks suppression, missing consent, frequency and closed service windows", () => {
    const c = configSchema.parse({});
    expect(eligibility(contact, c, false, 72, now)).toBeNull();
    expect(eligibility(contact, c, true, 72, now)).toBe("Descadastrado");
    expect(
      eligibility({ ...contact, optInStatus: "unknown" }, c, false, 72, now),
    ).toContain("Consentimento");
    expect(
      eligibility({ ...contact, lastMarketingAt: now }, c, false, 72, now),
    ).toContain("frequência");
    expect(
      eligibility(
        { ...contact, lastInboundAt: new Date("2026-09-28") },
        c,
        false,
        72,
        now,
      ),
    ).toContain("Janela");
  });
  it("never turns HTTP acceptance into delivery", () => {
    const r = metrics([
      {
        state: "sending",
        acceptedAt: now,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        repliedAt: null,
        optedOutAt: null,
        clickedAt: null,
      },
    ]);
    expect(r.accepted).toBe(1);
    expect(r.sent).toBe(0);
    expect(r.delivered).toBe(0);
  });
  it.each([
    [190, "pause"],
    [132015, "pause"],
    [130429, "rate"],
    [131049, "recipient_limit"],
    [131026, "permanent"],
    [131016, "transient"],
  ])("classifies code %s", (code, action) =>
    expect(classifyError(Number(code))).toBe(action),
  );
  it("requires the exact approved template and fills its variables", () => {
    const c = configSchema.parse({
      templateId: "template",
      message: "Olá {{1}}",
      variables: { "1": "{{nome}}" },
    });
    const p = buildPayload(
      c,
      template,
      { name: "Lucas", phone: "+5511987654321" },
      "attempt",
    ) as any;
    expect(p.template.components[0].parameters[0].text).toBe("Lucas");
    expect(p.biz_opaque_callback_data).toBe("attempt");
    expect(() =>
      validateContent({ ...c, message: "Mensagem não aprovada" }, template),
    ).toThrow();
    expect(() =>
      validateContent(c, { ...template, status: "PAUSED" }),
    ).toThrow();
  });
  it("prevents unsupported audio templates and mismatched button labels", () => {
    const c = configSchema.parse({
      templateId: "template",
      kind: "audio",
      mediaId: "media",
      message: "Olá {{1}}",
      variables: { "1": "Lucas" },
    });
    expect(() => validateContent(c, template)).toThrow(/Áudio/);
    const t = {
      ...template,
      components: [
        ...template.components,
        {
          type: "BUTTONS",
          buttons: [
            { type: "URL", text: "Inscrições", url: "https://tcr.test/evento" },
          ],
        },
      ],
    };
    expect(() =>
      validateContent(
        {
          ...c,
          kind: "text",
          ctaUrl: "https://tcr.test/evento",
          ctaLabel: "Outra coisa",
        },
        t,
      ),
    ).toThrow(/botão/);
  });
});
