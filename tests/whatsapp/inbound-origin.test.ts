import { describe, expect, it } from "vitest";
import { classifyWhatsAppInboundOrigin } from "@/features/whatsapp/inbound-origin";

describe("WhatsApp inbound origin", () => {
  it("identifies an explicit Click-to-WhatsApp ad referral", () => {
    expect(classifyWhatsAppInboundOrigin({ referral: { source_type: "ad", source_id: "123" } }))
      .toEqual({ kind: "meta_ad", adId: "123" });
  });

  it("keeps site and unrecognized messages on the support path", () => {
    expect(classifyWhatsAppInboundOrigin({})).toEqual({ kind: "support_default", adId: null });
    expect(classifyWhatsAppInboundOrigin({ referral: { source_type: "post", source_id: "123" } }))
      .toEqual({ kind: "support_default", adId: null });
    expect(classifyWhatsAppInboundOrigin({ referral: { source_type: "unknown" } }))
      .toEqual({ kind: "support_default", adId: null });
  });
});
