import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentAdmin } from "@/features/auth/auth.service";
import { numberedBoxPlanSchema, mergeNumberedBoxDraft, missingNumberedBoxFields, startsNumberedBoxes, isBoxFollowup, normalizeBoxText, type NumberedBoxDraft, type NumberedBoxProposal } from "./assistant-numbered-box";

type EventIndex = { id: string; title: string; city: string; slug: string; startsAt: Date; status: string };
export async function handleNumberedBoxRequest(admin: CurrentAdmin, message: string, events: EventIndex[], rank: (message: string, event: EventIndex) => number) {
  const row = await prisma.adminAuditLog.findFirst({ where: { adminUserId: admin.id, action: "ADMIN_ASSISTANT_BOX_DRAFT", metadata: { path: ["organizationId"], equals: admin.organizationId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const meta = row?.metadata as { draft?: NumberedBoxDraft } | undefined;
  const previous = meta?.draft?.phase === "collecting" ? meta.draft : null;
  const start = startsNumberedBoxes(message);
  if (!start && (!previous || !isBoxFollowup(message))) return null;
  const persist = async (draft: NumberedBoxDraft) => prisma.adminAuditLog.create({ data: { adminUserId: admin.id, action: "ADMIN_ASSISTANT_BOX_DRAFT", entityType: "ADMIN_ASSISTANT", metadata: JSON.parse(JSON.stringify({ organizationId: admin.organizationId, draft })) as Prisma.InputJsonValue } });
  if (/\b(cancele|cancelar|desista)\b/.test(normalizeBoxText(message))) {
    await persist({ phase: "complete" });
    return { text: "Pedido de criação de camarotes cancelado. Nenhum camarote foi criado.", proposal: null };
  }
  const ranks = events.map(event => ({ event, score: rank(message, event) })).filter(x => x.score > 0).sort((a,b) => b.score-a.score);
  const exact = events.find(e => message.includes(e.id));
  const candidate = exact || (ranks.length && (ranks.length === 1 || ranks[0].score > ranks[1].score) ? ranks[0].event : null);
  // A new explicitly selected event starts a new draft. Never inherit its price or capacity from another event.
  let draft = mergeNumberedBoxDraft(candidate && previous?.eventId && candidate.id !== previous.eventId ? {} : previous || {}, message);
  draft.phase = "collecting";
  if (candidate) { draft.eventId = candidate.id; draft.eventTitle = candidate.title; if (draft.error?.startsWith("Escolha o evento") || draft.error?.startsWith("O evento anterior")) draft.error = undefined; }
  if (draft.eventId && !events.some(e => e.id === draft.eventId)) draft = { phase: "collecting", error: "O evento anterior não está disponível no seu acesso. Informe o evento correto." };
  if (!draft.eventId && ranks.length > 1) draft.error = `Escolha o evento pela data ou ID: ${ranks.slice(0,3).map(x => `${x.event.title} — ${x.event.startsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} — ID ${x.event.id}`).join("; ")}.`;
  if (draft.eventId && (draft.feeStandard || draft.cardStandard)) {
    const lots = await prisma.ticketLot.findMany({ where: { eventId: draft.eventId, status: "ACTIVE" }, select: { serviceFeeBps: true, cardInterestBpsPerInstallment: true, cardInterestStartsAtInstallment: true } });
    const same = (key: keyof typeof lots[number]) => lots.length && new Set(lots.map(l => l[key])).size === 1 ? lots[0][key] : undefined;
    if (draft.feeStandard) draft.serviceFeeBps = same("serviceFeeBps");
    if (draft.cardStandard) {
      draft.cardInterestBpsPerInstallment = same("cardInterestBpsPerInstallment");
      draft.cardInterestStartsAtInstallment ??= same("cardInterestStartsAtInstallment");
    }
  }
  await persist(draft);
  const missing = missingNumberedBoxFields(draft);
  if (draft.error || missing.length) return { text: `${draft.eventTitle ? `Pedido em andamento: ${draft.eventTitle}. ` : ""}${draft.numbers?.length ? `Camarotes ${draft.numbers.join(", ")}${draft.admissionsPerUnit ? `, com ${draft.admissionsPerUnit} ingressos por camarote` : ""}. ` : ""}${draft.error || ""}${missing.length ? `Falta informar: ${missing.join("; ")}.` : ""} Nada foi criado ainda.`, proposal: null };
  const parsed = numberedBoxPlanSchema.safeParse({ ...draft, description: draft.description || "", status: draft.status || "ACTIVE" });
  if (!parsed.success) return { text: "Confira os valores: capacidade de 2 a 100 pessoas, preço mínimo R$ 10, taxa de até 30%, juros de até 10% e início entre a 1ª e a 12ª parcela. Nada foi criado.", proposal: null };
  const plan = parsed.data;
  const created = await prisma.adminAuditLog.create({ data: { adminUserId: admin.id, action: "ADMIN_ASSISTANT_PROPOSAL", entityType: "ADMIN_ASSISTANT", metadata: { organizationId: admin.organizationId, kind: "NUMBERED_BOX_CREATE", plan } } });
  const proposal: NumberedBoxProposal = { kind: "NUMBERED_BOX_CREATE", id: created.id, eventId: plan.eventId, eventTitle: plan.eventTitle, plan };
  return { text: `Preparei a criação em ${plan.eventTitle}: ${plan.numbers.length} camarotes numerados (${plan.numbers.join(", ")}), uma unidade de cada número, com ${plan.admissionsPerUnit} ingressos por camarote. Capacidade total: ${plan.numbers.length * plan.admissionsPerUnit} pessoas. Confira preço, taxas e numeração na proposta. Só vou salvar após a confirmação.`, proposal };
}
export async function finishNumberedBoxDraft(admin: CurrentAdmin) {
  await prisma.adminAuditLog.create({ data: { adminUserId: admin.id, action: "ADMIN_ASSISTANT_BOX_DRAFT", entityType: "ADMIN_ASSISTANT", metadata: { organizationId: admin.organizationId, draft: { phase: "complete" } } } });
}
