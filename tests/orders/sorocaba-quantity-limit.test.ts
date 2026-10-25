import { describe, expect, it } from "vitest";
import { effectiveLotMaxPerOrder, validateSorocabaOrderQuantity } from "@/features/orders/sorocaba-quantity-limit";

const sorocaba = "rodrigo-teaser-em-sorocaba-2026";

describe("limite por pedido de Sorocaba", () => {
  it("permite até 20 para cadeiras e primeira fileira, sem mudar mesas numeradas ou outros eventos", () => {
    expect(effectiveLotMaxPerOrder(sorocaba, { name: "CADEIRA PRATA - MEIA ENTRADA", hasTypeOptions: false, maxPerOrder: 10 })).toBe(20);
    expect(effectiveLotMaxPerOrder(sorocaba, { name: "PRIMEIRA FILEIRA - EXCLUSIVO", hasTypeOptions: false, maxPerOrder: 10 })).toBe(20);
    expect(effectiveLotMaxPerOrder(sorocaba, { name: "MESA PARA 04 PESSOAS", hasTypeOptions: true, maxPerOrder: 1 })).toBe(1);
    expect(effectiveLotMaxPerOrder("outro-evento", { name: "CADEIRA PRATA - MEIA ENTRADA", hasTypeOptions: false, maxPerOrder: 10 })).toBe(10);
  });

  it("bloqueia a soma acima de 20 mesmo quando distribuída entre lotes", () => {
    expect(() => validateSorocabaOrderQuantity(sorocaba, [12, 8])).not.toThrow();
    expect(() => validateSorocabaOrderQuantity(sorocaba, [12, 9])).toThrow(/20 ingressos/);
  });
});
