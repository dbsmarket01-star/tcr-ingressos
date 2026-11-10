import { z } from "zod";

export const numberedBoxPlanSchema = z.object({
  eventId: z.string().min(1), eventTitle: z.string().min(1),
  numbers: z.array(z.number().int().min(1).max(9999)).min(1).max(100),
  admissionsPerUnit: z.number().int().min(2).max(100),
  priceInCents: z.number().int().min(1000), description: z.string().max(4000).default(""),
  serviceFeeBps: z.number().int().min(0).max(3000),
  cardInterestBpsPerInstallment: z.number().int().min(0).max(1000),
  cardInterestStartsAtInstallment: z.number().int().min(1).max(12),
  status: z.enum(["ACTIVE", "PAUSED"]).default("ACTIVE")
}).refine(p => new Set(p.numbers).size === p.numbers.length, "Numeração repetida");
export type NumberedBoxPlan = z.infer<typeof numberedBoxPlanSchema>;
export type NumberedBoxDraft = Partial<NumberedBoxPlan> & { feeStandard?: boolean; cardStandard?: boolean; phase?: "collecting" | "complete"; error?: string };
export type NumberedBoxProposal = { kind: "NUMBERED_BOX_CREATE"; id: string; eventId: string; eventTitle: string; plan: NumberedBoxPlan };
export const normalizeBoxText = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function startsNumberedBoxes(message: string) {
  const t = normalizeBoxText(message);
  return /\b(crie|criar|sobe|suba|cadastrar|cadastre|adicione)\b/.test(t) && /\bcamarotes?\b/.test(t) && !/\bcompartilhad[oa]\b/.test(t);
}
export function isBoxFollowup(message: string) {
  const t = normalizeBoxText(message);
  if (/\b(mova|ordene|pause|reative|retire|consulte|verifique|publique evento)\b/.test(t)) return false;
  return /\b(camarotes?|parcela|parcelamento|juros|taxa|padrao|descricao|ativo|pausado|pessoas|ingressos|sobe|suba|crie|criar|nesse|isso|sim|cancele|cancelar|desista)\b|\d|%/.test(t);
}
/** Only user supplied fields are merged. Capacity never becomes inventory. */
export function mergeNumberedBoxDraft(previous: NumberedBoxDraft, message: string): NumberedBoxDraft {
  const next = { ...previous };
  const t = normalizeBoxText(message);
  const numbers = [...t.matchAll(/\bcamarotes?\s+(?:(?:de\s+)?numeros?\s*)?(\d+(?:\s*(?:,|e)\s*\d+)*)/g)]
    .flatMap(m => m[1].split(/\s*(?:,|e)\s*/).map(Number));
  if (numbers.length) next.numbers = [...new Set(numbers)].sort((a,b) => a-b);
  const capacity = t.match(/(?:para|com)\s+(\d+)\s+(?:pessoas|ingressos|lugares)/) || t.match(/(\d+)\s+(?:pessoas|ingressos|lugares)\s*(?:,?\s*(?:em\s+)?cada\s+camarote)?/);
  if (capacity) next.admissionsPerUnit = Number(capacity[1]);
  const priceText = t.replace(/\bcamarotes?\s+(?:(?:de\s+)?numeros?\s*)?(\d+(?:\s*(?:,|e)\s*\d+)*)/g, "");
  const money = [...priceText.matchAll(/(?<![\d,])(?:r\$\s*)?\b(\d+(?:\.\d{3})*,\d{2})(?!\d|,\s*\d|\s*%)/g)].map(m => Math.round(Number(m[1].replace(/\./g, "").replace(",", "."))*100));
  const integerPrice = t.match(/(?:preco|valor)\s*(?:de\s*)?(?:r\$\s*)?(\d+)(?![\d,.])/);
  if (money.length && new Set(money).size > 1) next.error = "Os preços informados são diferentes. Informe um preço único para este grupo de camarotes; grupos com preços diferentes devem ser cadastrados separadamente.";
  else if (money.length) { next.priceInCents = money[0]; next.error = undefined; }
  else if (integerPrice) next.priceInCents = Number(integerPrice[1])*100;
  if (/sem descricao/.test(t)) next.description = "";
  const desc = message.match(/descri[çc][ãa]o\s*:\s*([^\n]+)/i);
  if (desc) next.description = desc[1].trim();
  if (/\b(pausad[oa]|pausar)\b/.test(t)) next.status = "PAUSED";
  else if (/\b(ativ[oa]|sobe|suba|publique)\b/.test(t)) next.status = "ACTIVE";
  const fee = t.match(/(?:taxa(?:\s+(?:da|de))?\s+bilheteria|taxa de servico)\s*(?:de\s*)?[:=]?\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (fee) { next.serviceFeeBps = Math.round(Number(fee[1].replace(",", "."))*100); next.feeStandard = false; }
  if (/taxa.*padrao|padrao.*taxa/.test(t)) next.feeStandard = true;
  if (/parcelamento.*padrao|padrao.*parcelamento/.test(t)) next.cardStandard = true;
  const interest = t.match(/(?:juros|parcelamento)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*%/) || t.replace(fee?.[0] || "", "").match(/(\d+(?:[.,]\d+)?)\s*%.*(?:parcela|juros)/);
  if (interest) { next.cardInterestBpsPerInstallment = Math.round(Number(interest[1].replace(",", "."))*100); next.cardStandard = false; }
  const installment = t.match(/(?:a partir (?:da|de)|desde a)\s*(\d+)(?:a|ª|º)?\s*parcela/) || t.match(/^(\d+)(?:a|ª|º)?\s*parcela/);
  if (installment) next.cardInterestStartsAtInstallment = Number(installment[1]);
  else if (/segunda parcela/.test(t)) next.cardInterestStartsAtInstallment = 2;
  else if (/primeira parcela/.test(t)) next.cardInterestStartsAtInstallment = 1;
  if (/\bsem juros\b/.test(t)) { next.cardInterestBpsPerInstallment = 0; next.cardInterestStartsAtInstallment = 2; next.cardStandard = false; }
  return next;
}
export function missingNumberedBoxFields(d: NumberedBoxDraft) {
  return [!d.eventId && "evento exato (nome e cidade, data ou ID)", !d.numbers?.length && "números dos camarotes", !d.admissionsPerUnit && "quantas pessoas entram por camarote", d.priceInCents === undefined && "preço por camarote completo", d.serviceFeeBps === undefined && "taxa de bilheteria (ou peça a taxa padrão do evento)", d.cardInterestBpsPerInstallment === undefined && "juros do cartão (ou parcelamento padrão do evento)", d.cardInterestStartsAtInstallment === undefined && "a partir de qual parcela incidem os juros"].filter(Boolean) as string[];
}
