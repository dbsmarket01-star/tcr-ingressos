import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prepareAssistantImage } from "@/features/assistant/assistant-image";

describe("assistant image upload", () => {
  it("normalizes a phone screenshot for the vision request", async () => {
    const bytes = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#f5f5f5" } })
      .jpeg().toBuffer();
    const image = await prepareAssistantImage(new File([new Uint8Array(bytes)], "print.jpeg", { type: "image/jpeg" }));
    expect(image.mime).toBe("image/jpeg");
    expect(image.name).toBe("print.jpeg");
    expect(image.data.length).toBeGreaterThan(100);
    expect(Buffer.from(image.data, "base64").subarray(0, 2).toString("hex")).toBe("ffd8");
  });
});
