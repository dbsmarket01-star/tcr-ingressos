import { describe, it, expect } from "vitest";
import { mergeNumberedBoxDraft, numberedBoxPlanSchema, missingNumberedBoxFields, startsNumberedBoxes, type NumberedBoxDraft } from "@/features/assistant/assistant-numbered-box";
describe("numbered box user instructions", () => {
  it("preserves Lucas's fields through the entire multi-message request", () => {
    let d: NumberedBoxDraft = { eventId: "guilherme", eventTitle: "Guilherme Arantes São Caetano" };
    for(const text of ["sobe camarote para 10 pessoas, camarote 17,18 e 19", "guilherme arantes, precisa criar", "precisa ter 10 ingressos, em cada camarote, fez?", "CAMAROTE 17, SEM DESCRIÇÃO, 1497,90, ATIVO CAMAROTE 18, SEM DESCRIÇÃO, 1497,90, ATIVO CAMAROTE 19, SEM DESCRIÇÃO, 1497,90, ATIVO", "TAXA DA BILHETERIA PADRÃO", "AGORA SOBE", "PARCELAMENTO PADRÃO TBM", "SEGUNDA PARCELA", "ISSO, PERFEITO, AGORA SOBE", "4% A PARTIR DA SEGUNDA PARCELA", "em todos os camarote que te passei"]) d = mergeNumberedBoxDraft(d, text);
    expect(d).toMatchObject({ numbers:[17,18,19],admissionsPerUnit:10,priceInCents:149790,description:"",status:"ACTIVE",feeStandard:true,cardInterestBpsPerInstallment:400,cardInterestStartsAtInstallment:2 });
    expect(numberedBoxPlanSchema.parse({...d,serviceFeeBps:2000}).numbers).toHaveLength(3);
    expect(missingNumberedBoxFields({...d,serviceFeeBps:2000})).toEqual([]);
  });
  it("does not invent prices or treat capacity as inventory", () => {
    const d=mergeNumberedBoxDraft({},"Crie camarotes 17,18,19 para 10 pessoas");
    expect(d).toEqual({numbers:[17,18,19],admissionsPerUnit:10});
    expect(missingNumberedBoxFields(d)).toContain("preço por camarote completo");
  });
  it("rejects repeated numbers and invalid capacity at the execution boundary",()=>{
    expect(numberedBoxPlanSchema.safeParse({eventId:'e',eventTitle:'e',numbers:[17,17],admissionsPerUnit:10,priceInCents:149790,serviceFeeBps:2000,cardInterestBpsPerInstallment:400,cardInterestStartsAtInstallment:2}).success).toBe(false);
  });
  it("keeps conflicting prices blocked until corrected",()=>{
    const d=mergeNumberedBoxDraft({priceInCents:10000},"Camarote 17 R$ 1.497,90; Camarote 18 R$ 1.597,90");
    expect(mergeNumberedBoxDraft(d,"sobe").error).toBeTruthy();
    expect(mergeNumberedBoxDraft(d,"valor 1.497,90 para todos").error).toBeUndefined();
  });
  it("separates fees and interest supplied in the same message", () => {
    expect(mergeNumberedBoxDraft({}, "taxa da bilheteria 20%, juros 4% a partir da segunda parcela"))
      .toMatchObject({serviceFeeBps:2000,cardInterestBpsPerInstallment:400,cardInterestStartsAtInstallment:2});
  });
  it("does not hijack shared-box creation",()=>expect(startsNumberedBoxes("crie camarote compartilhado")).toBe(false));
});
