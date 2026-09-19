import { describe, expect, it } from "vitest";
import { checkoutOrderSchema } from "@/features/orders/order.schema";

const validOrder = {
  eventId: "event_1",
  eventSlug: "evento-teste",
  buyerName: "Comprador Teste",
  buyerEmail: "comprador@example.com",
  buyerDocument: "52998224725",
  buyerPostalCode: "01001000",
  buyerCity: "São Paulo",
  items: [{ lotId: "lot_1", quantity: 1 }]
};

describe("checkout order schema", () => {
  it("accepts Brazilian phones with DDD", () => {
    expect(checkoutOrderSchema.safeParse({ ...validOrder, buyerPhone: "(11) 99999-9999" }).success).toBe(true);
  });

  it("rejects phones with extra digits before reserving an order", () => {
    const parsed = checkoutOrderSchema.safeParse({ ...validOrder, buyerPhone: "119990277996" });
    expect(parsed.success).toBe(false);
  });

  it("keeps the support phone optional", () => {
    expect(checkoutOrderSchema.safeParse(validOrder).success).toBe(true);
  });
});
