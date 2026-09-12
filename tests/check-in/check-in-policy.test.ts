import { describe, expect, it } from "vitest";
import { getCheckInDecision } from "@/features/check-in/check-in-policy";

describe("getCheckInDecision", () => {
  it("aprova somente ingresso ativo", () => {
    expect(getCheckInDecision({ status: "ACTIVE" })).toBe("APPROVED");
  });

  it("bloqueia reutilizacao", () => {
    expect(getCheckInDecision({ status: "USED" })).toBe("ALREADY_USED");
  });

  it("bloqueia ingresso cancelado ou invalidado", () => {
    expect(getCheckInDecision({ status: "CANCELED" })).toBe("CANCELED");
    expect(getCheckInDecision({ status: "INVALID" })).toBe("INVALID");
  });

  it("rejeita codigo inexistente", () => {
    expect(getCheckInDecision()).toBe("INVALID");
  });
});
