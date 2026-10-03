import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { inspectMedia, uploadLimit } from "@/features/whatsapp/campaigns/media";
import { uploadMime } from "@/features/whatsapp/campaigns/media-policy";
import {
  configSchema,
  validateContent,
} from "@/features/whatsapp/campaigns/rules";
const fixture = (name: string) => readFile(`tests/whatsapp/fixtures/${name}`);
describe("real campaign media validation", () => {
  it.each([
    ["image.png", "image/png", "image"],
    ["audio.mp3", "audio/mpeg", "audio"],
    ["audio.m4a", "audio/mp4", "audio"],
    ["video.mp4", "video/mp4", "video"],
  ])("inspects %s bytes and codecs", async (name, mime, kind) => {
    const result = await inspectMedia(await fixture(name), mime, name);
    expect(result.kind).toBe(kind);
    expect(result.receivedSize).toBeGreaterThan(0);
  });
  it("accepts browser M4A aliases and empty MIME without trusting the extension", async () => {
    expect(uploadMime("voice.m4a", "audio/x-m4a")).toBe("audio/mp4");
    expect(uploadMime("voice.mp3", "")).toBe("audio/mpeg");
    expect(uploadLimit("audio/x-m4a")).toBe(16 * 1024 * 1024);
    await expect(
      inspectMedia(await fixture("image.png"), "audio/mp4", "fake.m4a"),
    ).rejects.toThrow("conteúdo");
  });
  it("rejects video disguised as an M4A audio container", async () => {
    await expect(
      inspectMedia(await fixture("video.mp4"), "audio/mp4", "fake.m4a"),
    ).rejects.toThrow("Codec");
  });
  it("rejects captions above the provider limit before confirmation", () => {
    expect(() =>
      validateContent(
        configSchema.parse({
          kind: "video",
          mediaId: "file",
          message: "x".repeat(1025),
        }),
        null,
      ),
    ).toThrow("1.024");
  });
});
