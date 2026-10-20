import { describe, expect, it } from "vitest";
import { mergeWhatsAppMessages } from "@/features/crm/whatsapp-live-delta";

describe("WhatsApp live conversation delta", () => {
  it("adds only new messages and deduplicates a fetch that races with the notification", () => {
    const first = { id: "one", createdAt: new Date("2026-10-20T10:00:00Z") };
    const next = { id: "two", createdAt: new Date("2026-10-20T10:01:00Z") };
    expect(mergeWhatsAppMessages([first], [next])).toEqual([first, next]);
    expect(mergeWhatsAppMessages([next, first], [next])).toEqual([first, next]);
  });

  it("keeps only the latest history window when new messages arrive", () => {
    const history = Array.from({ length: 80 }, (_, index) => ({ id: String(index), createdAt: new Date(1_000 + index) }));
    const next = { id: "new", createdAt: new Date(2_000) };
    const result = mergeWhatsAppMessages(history, [next]);
    expect(result).toHaveLength(80);
    expect(result[0].id).toBe("1");
    expect(result.at(-1)?.id).toBe("new");
  });
});
