import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canAccessArea, canAccessEvent, getCurrentAdmin } from "@/features/auth/auth.service";
import { answerAssistant, discardAssistantProposal, getAssistantImage, getAssistantProposal, getPendingAssistantProposal, listAssistantMessages, saveAssistantConfirmation } from "@/features/assistant/admin-assistant.service";
import { prepareAssistantImage } from "@/features/assistant/assistant-image";
import { applyAssistantLotChanges, applyAssistantLotOrder, updateTicketLotPricing } from "@/features/lots/lot.service";
import { updateEventStatus } from "@/features/events/event.service";
import { ticketLotPricingSchema } from "@/features/lots/lot.schema";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function authorizedAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin || !canAccessArea(admin.role, "SUPPORT")) return null;
  const organization = await prisma.organization.findUnique({ where: { id: admin.organizationId }, select: { slug: true } });
  return organization?.slug === "tcr-ingressos" ? admin : null;
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const admin = await authorizedAdmin();
  if (!admin) return error("Acesso não autorizado.", 403);
  const imageId = request.nextUrl.searchParams.get("imageId");
  if (imageId) {
    if (imageId.length > 100) return error("Imagem inválida.");
    const image = await getAssistantImage(admin, imageId);
    if (!image) return error("Imagem não encontrada.", 404);
    return new NextResponse(new Uint8Array(image.bytes), { headers: {
      "Content-Type": image.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"
    } });
  }
  const { searchParams } = request.nextUrl;
  const [history, proposal] = await Promise.all([
    listAssistantMessages(admin, { period: searchParams.get("period") || "today", date: searchParams.get("date") || "", before: searchParams.get("before") || "" }),
    getPendingAssistantProposal(admin)
  ]);
  return NextResponse.json({ ...history, proposal });
}

export async function POST(request: NextRequest) {
  const admin = await authorizedAdmin();
  if (!admin) return error("Acesso não autorizado.", 403);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return error("Origem inválida.", 403);
  const isMultipart = request.headers.get("content-type")?.startsWith("multipart/form-data") || false;
  const body = isMultipart ? await request.formData().catch(() => null) : await request.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Pedido inválido.");
  const field = (name: string) => body instanceof FormData ? body.get(name) : (body as Record<string, unknown>)[name];

  if (field("type") === "message") {
    const candidate = field("image");
    if (candidate && !(candidate instanceof File)) return error("Imagem inválida.");
    const message = String(field("message") || (candidate ? "Analise esta imagem e me diga o que encontrou." : "")).trim();
    if (!message || message.length > 2000) return error("Escreva um pedido com até 2.000 caracteres.");
    try {
      const image = candidate instanceof File ? await prepareAssistantImage(candidate) : undefined;
      return NextResponse.json(await answerAssistant(admin, message, image));
    } catch (cause) {
      console.error("[admin-assistant] Falha ao responder", cause);
      if (cause instanceof Error && /^(Envie|O arquivo|Imagem inválida|A imagem)/.test(cause.message)) return error(cause.message);
      if (cause instanceof Error && cause.message.includes("credit_balance_exhausted")) {
        return error("O Assistente IA está temporariamente indisponível: a conta da API OpenAI está sem crédito. Nenhuma alteração foi feita.", 503);
      }
      if (cause instanceof Error && cause.name === "TimeoutError") {
        return error("A análise demorou mais que o esperado. Tente enviar um recorte menor do print; nenhuma alteração foi feita.", 504);
      }
      if (cause instanceof Error && cause.message.startsWith("A IA retornou HTTP")) {
        return error(`${cause.message} Nenhuma alteração foi feita.`, 503);
      }
      return error("Não consegui processar o pedido agora. Nenhuma alteração foi feita.", 503);
    }
  }

  if (body.type === "confirm") {
    if (!canAccessArea(admin.role, "EVENTS")) return error("Seu perfil pode consultar o assistente, mas não alterar eventos ou ingressos.", 403);
    const proposalId = String(field("proposalId") || "").trim();
    if (!proposalId) return error("Proposta não informada.");
    const proposal = await getAssistantProposal(admin, proposalId);
    if (!proposal) return error("Proposta não encontrada ou sem autorização.", 404);
    if (!canAccessEvent(admin, proposal.eventId)) return error("Você não tem acesso a este evento.", 403);
    const previouslyResolved = await prisma.adminAuditLog.findFirst({ where: { action: { in: ["ADMIN_ASSISTANT_APPLIED", "ADMIN_ASSISTANT_DISCARDED"] }, entityType: "ADMIN_ASSISTANT", entityId: proposal.id }, select: { id: true } });
    if (previouslyResolved) return error("Esta proposta já foi concluída ou cancelada.", 409);
    if (proposal.kind === "LOT_ORDER_CHANGE") {
      const event = await prisma.event.findFirst({ where: { id: proposal.eventId, organizationId: admin.organizationId },
        select: { id: true, slug: true, title: true } });
      if (!event) return error("Evento não encontrado.", 404);
      try {
        const verified = await applyAssistantLotOrder(event.id, proposal.expectedIds, proposal.desiredIds);
        revalidatePath(`/evento/${event.slug}`);
        revalidatePath(`/evento/${event.slug}/checkout`);
        revalidatePath(`/admin/events/${event.id}/lots`);
        const text = `Ordem gravada e conferida para ${event.title}: ${verified.length} ingressos visíveis, sem posições repetidas. Setores e categorias seguem a sequência aprovada; preços, estoques, cores, status e vendas foram preservados.`;
        const message = await saveAssistantConfirmation(admin, proposal, text);
        return NextResponse.json({ message });
      } catch (cause) {
        console.error("[admin-assistant] Falha ao ordenar ingressos", cause);
        return error(cause instanceof Error ? cause.message : "Não consegui confirmar a ordem dos ingressos.", 409);
      }
    }
    if (proposal.kind === "LOT_CHANGES") {
      const event = await prisma.event.findFirst({ where: { id: proposal.eventId, organizationId: admin.organizationId }, select: { id: true, slug: true, title: true } });
      if (!event) return error("Evento não encontrado.", 404);
      try {
        await applyAssistantLotChanges(event.id, proposal.changes);
        revalidatePath(`/evento/${event.slug}`);
        revalidatePath(`/evento/${event.slug}/checkout`);
        revalidatePath(`/admin/events/${event.id}/lots`);
        const text = `Confirmei no sistema ${proposal.changes.length} alteração(ões) de ingresso em ${event.title}. Confira a lista atualizada no painel e na página pública.`;
        const message = await saveAssistantConfirmation(admin, proposal, text);
        return NextResponse.json({ message });
      } catch (cause) {
        console.error("[admin-assistant] Falha ao alterar ingressos", cause);
        return error(cause instanceof Error ? cause.message : "Não consegui alterar os ingressos. Nenhuma mudança parcial foi feita.", 409);
      }
    }
    if (proposal.kind === "EVENT_STATUS_CHANGE") {
      const event = await prisma.event.findFirst({
        where: { id: proposal.eventId, organizationId: admin.organizationId },
        select: { id: true, title: true, slug: true, status: true }
      });
      if (!event) return error("Evento não encontrado.", 404);
      if (event.status !== proposal.oldStatus) return error("O status mudou desde a proposta. Peça uma nova conferência.", 409);
      try {
        await updateEventStatus(event.id, proposal.newStatus);
        const verified = await prisma.event.findUnique({ where: { id: event.id }, select: { status: true } });
        if (verified?.status !== proposal.newStatus) throw new Error("Status não confirmado após a gravação.");
        revalidatePath("/admin/events");
        revalidatePath(`/admin/events/${event.id}`);
        revalidatePath("/");
        revalidatePath("/sitemap.xml");
        revalidatePath(`/evento/${event.slug}`);
        revalidatePath(`/evento/${event.slug}/checkout`);
        revalidatePath(`/lista/${event.slug}`);
        const text = proposal.newStatus === "UNPUBLISHED"
          ? `Alteração confirmada: ${event.title} foi retirado do ar e está inativo. Conferi o status salvo no sistema. Ingressos e vendas existentes foram preservados.`
          : `Alteração confirmada: ${event.title} foi publicado. Conferi o status salvo no sistema.`;
        const message = await saveAssistantConfirmation(admin, proposal, text);
        return NextResponse.json({ message });
      } catch (cause) {
        console.error("[admin-assistant] Falha ao alterar status do evento", cause);
        return error("Não consegui confirmar o status do evento. Confira a página do evento antes de tentar novamente.", 503);
      }
    }
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
  if (field("type") === "discard") {
    const proposalId = String(field("proposalId") || "").trim();
    if (!proposalId) return error("Proposta não informada.");
    await discardAssistantProposal(admin, proposalId);
    return NextResponse.json({ ok: true });
  }
  return error("Operação não reconhecida.");
}
