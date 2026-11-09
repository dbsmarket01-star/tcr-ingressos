import { describe, expect, it } from "vitest";
import { activeSolidarityLots, isPauseSolidarityRequest } from "@/features/assistant/assistant-solidarity";

describe("assistant solidarity pause", () => {
  it("recognizes a request to pause solidários", () => {
    expect(isPauseSolidarityRequest("Pause os ingressos solidários do Fernandinho em Santo André")).toBe(true);
    expect(isPauseSolidarityRequest("Quais são os ingressos solidários?")).toBe(false);
  });

  it("selects every active solidarity lot, and never a meia-entrada", () => {
    const lots = [
      { name: "PISTA - SOLIDÁRIO", status: "PAUSED" },
      { name: "CADEIRA - SOLIDÁRIO", status: "ACTIVE" },
      { name: "SETOR PREMIUM - SOLIDÁRIO", status: "ACTIVE" },
      { name: "PISTA - MEIA ENTRADA", status: "ACTIVE" },
      { name: "CADEIRA - BLACK NOVEMBER", status: "ACTIVE" }
    ];
    expect(activeSolidarityLots(lots).map((lot) => lot.name)).toEqual([
      "CADEIRA - SOLIDÁRIO", "SETOR PREMIUM - SOLIDÁRIO"
    ]);
  });
});
