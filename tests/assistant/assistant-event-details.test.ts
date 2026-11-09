import { describe, expect, it } from "vitest";
import { validateAssistantEventValue } from "@/features/assistant/admin-assistant.service";

describe("assistant event details validation", () => {
  it("accepts a dated change only with an explicit timezone", () => {
    expect(validateAssistantEventValue("startsAt", "2026-11-30T21:00:00-03:00")).toBe("2026-12-01T00:00:00.000Z");
    expect(validateAssistantEventValue("startsAt", "2026-11-30T21:00:00")).toBeNull();
    expect(validateAssistantEventValue("startsAt", "")).toBeNull();
  });

  it("requires public HTTPS image URLs and allows clearing optional media", () => {
    expect(validateAssistantEventValue("bannerUrl", "https://example.com/banner.jpg")).toBe("https://example.com/banner.jpg");
    expect(validateAssistantEventValue("eventMapImageUrl", "")).toBe("");
    expect(validateAssistantEventValue("bannerUrl", "http://example.com/banner.jpg")).toBeNull();
    expect(validateAssistantEventValue("bannerUrl", "file:///tmp/banner.jpg")).toBeNull();
  });

  it("rejects blank mandatory fields and overlong SEO titles", () => {
    expect(validateAssistantEventValue("title", "  ")).toBeNull();
    expect(validateAssistantEventValue("city", "A")).toBeNull();
    expect(validateAssistantEventValue("state", "sp")).toBe("SP");
    expect(validateAssistantEventValue("seoTitle", "a".repeat(71))).toBeNull();
    expect(validateAssistantEventValue("eventMapTemplate", "CLUB")).toBe("CLUB");
    expect(validateAssistantEventValue("eventMapTemplate", "UNKNOWN")).toBeNull();
    expect(validateAssistantEventValue("supportWhatsappUrl", "https://example.com/chat")).toBeNull();
    expect(validateAssistantEventValue("supportWhatsappUrl", "https://wa.me/5511999999999")).toBe("https://wa.me/5511999999999");
  });
});
