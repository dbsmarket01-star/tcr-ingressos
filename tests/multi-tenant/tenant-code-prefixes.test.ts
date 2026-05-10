import { describe, expect, it } from "vitest";
import { createOrderCode } from "@/features/orders/order.service";
import { createTicketCode } from "@/features/tickets/ticket-code";

describe("tenant code prefixes", () => {
  it("keeps new order and ticket codes neutral across child operations", () => {
    const orderCode = createOrderCode();
    const ticketCode = createTicketCode();

    expect(orderCode).toMatch(/^ING-/);
    expect(ticketCode).toMatch(/^ING-/);
    expect(orderCode).not.toMatch(/^TCR-/);
    expect(ticketCode).not.toMatch(/^TCR-/);
  });
});
