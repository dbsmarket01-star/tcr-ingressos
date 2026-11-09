import { describe, expect, it } from "vitest";
import { activeSolidarityLots, isPauseSolidarityRequest } from "@/features/assistant/assistant-solidarity";
import { ownAssistantContext } from "@/features/assistant/admin-assistant.service";

describe("assistant solidarity pause", () => {
  it("recognizes a request to pause solidários", () => {
    expect(isPauseSolidarityRequest("Pause os ingressos solidários do Fernandinho em Santo André")).toBe(true);
    expect(isPauseSolidarityRequest("Tira todos os solidários do Geriatricus em Santo André")).toBe(true);
    expect(isPauseSolidarityRequest("Quais são os ingressos solidários?")).toBe(false);
  });

  it("keeps shared history visible while using only the requesting operator's context", () => {
    const messages = [
      { authorId: "diego", text: "Fernandinho em Santo André" },
      { authorId: "lucas", text: "Geriatricus em Santo André" },
      { authorId: "lucas", text: "tira todos os solidários" }
    ];
    expect(ownAssistantContext(messages, "lucas").map((item) => item.text)).toEqual([
      "Geriatricus em Santo André", "tira todos os solidários"
    ]);
    expect(messages).toHaveLength(3);
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
