export type WhatsAppInboundOrigin =
  | { kind: "meta_ad"; adId: string | null }
  | { kind: "support_default"; adId: null };

/** Only an explicit Click-to-WhatsApp ad referral can start the sales journey. */
export function classifyWhatsAppInboundOrigin(message: {
  referral?: { source_type?: unknown; source_id?: unknown } | null;
}): WhatsAppInboundOrigin {
  const referral = message.referral;
  if (referral?.source_type === "ad") {
    const adId = typeof referral.source_id === "string" && referral.source_id.trim()
      ? referral.source_id.trim()
      : null;
    return { kind: "meta_ad", adId };
  }
  return { kind: "support_default", adId: null };
}
