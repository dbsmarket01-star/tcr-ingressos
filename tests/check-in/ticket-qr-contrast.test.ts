import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import sharp from "sharp";
import { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, QRCodeReader } from "@zxing/library";
import { createTicketQrCodeSvg } from "@/features/tickets/ticket-qrcode";

it("decodes synthetic ticket QR at mobile and PDF-like sizes", async () => {
  const token = "synthetic-checkin-token-not-a-customer-ticket";
  const svg = await createTicketQrCodeSvg(token);
  for (const size of [144, 240, 320]) {
    const { data, info } = await sharp(Buffer.from(svg)).resize(size, size).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const luminance = new Uint8ClampedArray(info.width * info.height);
    for (let i = 0; i < luminance.length; i++) luminance[i] = data[i * info.channels];
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, info.width, info.height)));
    expect(new QRCodeReader().decode(bitmap).getText()).toBe(token);
    expect(luminance[0]).toBe(255);
  }
});

it("protects QR light scheme without replacing internal SVG colors", () => {
  const css = readFileSync("app/styles.css", "utf8");
  for (const selector of [".ticketQrCode", ".ticketQrCode svg"]) {
    const start = css.indexOf(`${selector} {`);
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toContain("color-scheme: only light");
    expect(rule).toContain("forced-color-adjust: none");
    expect(rule).toContain("background: #fff");
  }
  expect(css).not.toMatch(/\.ticketQrCode\s+svg\s+(path|rect)\s*\{/);
});
