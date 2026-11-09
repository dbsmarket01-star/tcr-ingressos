import { describe, expect, it } from "vitest";
import { prepareAssistantImage } from "@/features/assistant/assistant-image";

describe("assistant image upload", () => {
  it("preserves a screenshot for the vision request without a native image dependency", async () => {
    const bytes = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==", "base64");
    const image = await prepareAssistantImage(new File([new Uint8Array(bytes)], "print.jpeg", { type: "image/jpeg" }));
    expect(image.mime).toBe("image/jpeg");
    expect(image.name).toBe("print.jpeg");
    expect(image.data).toBe(bytes.toString("base64"));
    expect(Buffer.from(image.data, "base64").subarray(0, 2).toString("hex")).toBe("ffd8");
  });
});
