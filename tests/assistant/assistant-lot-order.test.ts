import { describe, expect, it } from "vitest";
import { isTicketOrderRequest, proposedTicketOrder } from "@/features/assistant/assistant-lot-order";

const lot = (id: string, name: string, sortOrder: number, priceInCents: number, status = "ACTIVE") =>
  ({ id, name, sortOrder, priceInCents, status });

describe("assistant ticket ordering", () => {
  it("recognizes ordering but not mere price or name changes", () => {
    expect(isTicketOrderRequest("Organize os ingressos: meia, Black November e inteira em cada setor")).toBe(true);
    expect(isTicketOrderRequest("Aumente o preço do ingresso inteira")).toBe(false);
  });

  it("preserves sector sequence and orders category within each sector", () => {
    const rows = [
      lot("pb", "PISTA - BLACK NOVEMBER", 0, 6790), lot("pi", "PISTA - INTEIRA", 1, 19790),
      lot("pm", "PISTA - MEIA ENTRADA", 2, 6790), lot("cb", "CADEIRA - BLACK NOVEMBER", 3, 9790),
      lot("ci", "CADEIRA - INTEIRA", 4, 19790), lot("cm", "CADEIRA - MEIA ENTRADA", 5, 9790),
      lot("ps", "PISTA - SOLIDÁRIO", 6, 6790, "PAUSED")
    ];
    expect(proposedTicketOrder(rows).map((item) => item.id)).toEqual(["pm", "pb", "pi", "cm", "cb", "ci"]);
  });
});
