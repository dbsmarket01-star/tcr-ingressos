import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canAccessArea, canAccessEvent, getCurrentAdmin } from "@/features/auth/auth.service";
import { answerAssistant, discardAssistantProposal, getAssistantProposal, getPendingAssistantProposal, listAssistantMessages, saveAssistantConfirmation } from "@/features/assistant/admin-assistant.service";
import { updateTicketLotPricing } from "@/features/lots/lot.service";
import { ticketLotPricingSchema } from "@/features/lots/lot.schema";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function authorizedAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin || !canAccessArea(admin.role, "SUPPORT")) return null;
  const organization = await prisma.organization.findUnique({ where: { id: admin.organizationId }, select: { slug: true } });
  return organization?.slug === "tcr-ingressos" ? admin : null;
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const admin = await authorizedAdmin();
  if (!admin) return error("Acesso não autorizado.", 403);
  const [messages, proposal] = await Promise.all([listAssistantMessages(admin), getPendingAssistantProposal(admin)]);
  return NextResponse.json({ messages, proposal });
}

export async function POST(request: NextRequest) {
  const admin = await authorizedAdmin();
  if (!admin) return error("Acesso não autorizado.", 403);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return error("Origem inválida.", 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Pedido inválido.");

  if (body.type === "message") {
    const message = String(body.message || "").trim();
    if (!message || message.length > 2000) return error("Escreva um pedido com até 2.000 caracteres.");
    try {
      return NextResponse.json(await answerAssistant(admin, message));
    } catch (cause) {
      console.error("[admin-assistant] Falha ao responder", cause);
      if (cause instanceof Error && cause.message.includes("credit_balance_exhausted")) {
        return error("O Assistente IA está temporariamente indisponível: a conta da API OpenAI está sem crédito. Nenhuma alteração foi feita.", 503);
      }
      return error("Não consegui processar o pedido agora. Nenhuma alteração foi feita.", 503);
    }
  }

  if (body.type === "confirm") {
    if (!canAccessArea(admin.role, "EVENTS")) return error("Seu perfil pode consultar o assistente, mas não alterar ingressos.", 403);
    const proposalId = String(body.proposalId || "").trim();
    if (!proposalId) return error("Proposta não informada.");
    const proposal = await getAssistantProposal(admin, proposalId);
    if (!proposal) return error("Proposta não encontrada ou sem autorização.", 404);
    if (!canAccessEvent(admin, proposal.eventId)) return error("Você não tem acesso a este evento.", 403);
    const previouslyResolved = await prisma.adminAuditLog.findFirst({ where: { action: { in: ["ADMIN_ASSISTANT_APPLIED", "ADMIN_ASSISTANT_DISCARDED"] }, entityType: "ADMIN_ASSISTANT", entityId: proposal.id }, select: { id: true } });
    if (previouslyResolved) return error("Esta proposta já foi concluída ou cancelada.", 409);
    const lot = await prisma.ticketLot.findFirst({
      where: { id: proposal.lotId, eventId: proposal.eventId, event: { organizationId: admin.organizationId } },
      select: { id: true, name: true, priceInCents: true, serviceFeeBps: true, pixDiscountPercentBps: true,
        pixDiscountFixedInCents: true, cardInterestBpsPerInstallment: true, cardInterestStartsAtInstallment: true,
        event: { select: { slug: true, title: true } } }
    });
    if (!lot) return error("Ingresso não encontrado neste evento.", 404);
    if (lot.priceInCents !== proposal.oldPriceInCents) return error("O preço mudou desde a proposta. Peça uma nova conferência antes de alterar.", 409);
    if (!Number.isSafeInteger(proposal.newPriceInCents)) return error("Preço proposto inválido.");
    const pricing = ticketLotPricingSchema.safeParse({
      priceInCents: proposal.newPriceInCents, serviceFeeBps: lot.serviceFeeBps,
      pixDiscountPercentBps: lot.pixDiscountPercentBps, pixDiscountFixedInCents: lot.pixDiscountFixedInCents,
      cardInterestBpsPerInstallment: lot.cardInterestBpsPerInstallment,
      cardInterestStartsAtInstallment: lot.cardInterestStartsAtInstallment
    });
    if (!pricing.success) return error(pricing.error.issues[0]?.message || "Preço inválido.");
    try {
      await updateTicketLotPricing(lot.id, pricing.data);
      const verified = await prisma.ticketLot.findUnique({ where: { id: lot.id }, select: { priceInCents: true } });
      if (verified?.priceInCents !== proposal.newPriceInCents) throw new Error("Preço não confirmado após a gravação.");
      revalidatePath(`/evento/${lot.event.slug}`);
      revalidatePath(`/admin/events/${proposal.eventId}/lots`);
      const formatted = (value: number) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const text = `Alteração confirmada: ${lot.event.title} — ${lot.name}. Preço anterior ${formatted(proposal.oldPriceInCents)}; novo preço ${formatted(proposal.newPriceInCents)}. Conferi o valor salvo no sistema.`;
      const message = await saveAssistantConfirmation(admin, proposal, text);
      return NextResponse.json({ message });
    } catch (cause) {
      console.error("[admin-assistant] Falha ao alterar preço", cause);
      return error("Não consegui confirmar a alteração. Confira o preço do ingresso antes de tentar novamente.", 503);
    }
  }
  if (body.type === "discard") {
    const proposalId = String(body.proposalId || "").trim();
    if (!proposalId) return error("Proposta não informada.");
    await discardAssistantProposal(admin, proposalId);
    return NextResponse.json({ ok: true });
  }
  return error("Operação não reconhecida.");
}
