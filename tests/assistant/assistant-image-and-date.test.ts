import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prepareAssistantImage } from "@/features/assistant/assistant-image";
import { formatAssistantEventDate, rankAssistantEvent } from "@/features/assistant/admin-assistant.service";

describe("assistant image and event date", () => {
  it("uses the event date in São Paulo instead of the UTC calendar day", () => {
    const event = {
      title: "Fernandinho em Santo André", city: "Santo André", slug: "fernandinho-santo-andre-2026",
      startsAt: new Date("2026-11-21T00:00:00.000Z")
    };
    expect(formatAssistantEventDate(event.startsAt)).toBe("20/11/2026 21:00");
    expect(rankAssistantEvent("Fernandinho 20/11/2026", event)).toBeGreaterThan(rankAssistantEvent("Fernandinho 21/11/2026", event));
    expect(rankAssistantEvent("Fernandinho 20 de novembro de 2026", event)).toBeGreaterThan(rankAssistantEvent("Fernandinho 21 de novembro de 2026", event));
    expect(rankAssistantEvent("https://www.tcringressos.app.br/evento/fernandinho-santo-andre-2026", event)).toBeGreaterThan(50);
  });

  it("normalizes a valid print and rejects a file with a fake MIME type", async () => {
    const png = await sharp({ create: { width: 80, height: 80, channels: 3, background: "#0b7b4f" } }).png().toBuffer();
    const valid = new File([new Uint8Array(png)], "print.png", { type: "image/png" });
    const prepared = await prepareAssistantImage(valid);
    expect(prepared.mime).toBe("image/png");
    expect(Buffer.from(prepared.data, "base64").subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    await expect(prepareAssistantImage(new File(["not a png"], "fake.png", { type: "image/png" })))
      .rejects.toThrow("não corresponde");
  });
});
