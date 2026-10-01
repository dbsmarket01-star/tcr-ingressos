import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyWhatsAppMetaSignature } from "@/features/whatsapp/whatsapp.service";

const originalSecret = process.env.WHATSAPP_APP_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.WHATSAPP_APP_SECRET;
  } else {
    process.env.WHATSAPP_APP_SECRET = originalSecret;
  }
});

describe("WhatsApp Meta webhook signature", () => {
  it("accepts Meta's valid HMAC signature", () => {
    process.env.WHATSAPP_APP_SECRET = "test-secret";
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const digest = createHmac("sha256", "test-secret")
      .update(body, "utf8")
      .digest("hex");

    expect(verifyWhatsAppMetaSignature(body, `sha256=${digest}`)).toBe(true);
  });

  it("rejects missing or altered signatures when the app secret is configured", () => {
    process.env.WHATSAPP_APP_SECRET = "test-secret";
    const body = JSON.stringify({ object: "whatsapp_business_account" });

    expect(verifyWhatsAppMetaSignature(body, null)).toBe(false);
    expect(verifyWhatsAppMetaSignature(body, `sha256=${"0".repeat(64)}`)).toBe(
      false,
    );
  });

  it("rejects webhook traffic when the app secret is absent", () => {
    delete process.env.WHATSAPP_APP_SECRET;

    expect(verifyWhatsAppMetaSignature("{}", null)).toBe(false);
  });
});
