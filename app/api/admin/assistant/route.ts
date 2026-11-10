import { claimAssistantResolution } from "@/features/assistant/assistant-resolution";
import { importPlanSchema, type ImportProposal } from "@/features/assistant/assistant-event-import";
import { executeEventImport, findImportDuplicates, verifyImportedPublicPage } from "@/features/assistant/assistant-import-execution";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canAccessArea, canAccessEvent, getCurrentAdmin } from "@/features/auth/auth.service";
import { answerAssistant, discardAssistantProposal, getAssistantImage, getAssistantProposal, getPendingAssistantProposal, listAssistantMessages, saveAssistantConfirmation, validateAssistantEventValue } from "@/features/assistant/admin-assistant.service";
import { prepareAssistantImage } from "@/features/assistant/assistant-image";
import { applyAssistantLotChanges, applyAssistantLotOrder, updateTicketLotPricing } from "@/features/lots/lot.service";
import { createEvent, updateEventStatus } from "@/features/events/event.service";
import { eventDraftSchema } from "@/features/events/event.schema";
import { ticketLotPricingSchema } from "@/features/lots/lot.schema";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { savePublicImageUpload } from "@/features/uploads/local-upload.service";

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

  if (field("type") === "prepareImport") {
    if (admin.role !== "OWNER") return error("A importação exige acesso de proprietário.", 403);
    const setup = await getAssistantProposal(admin, String(field("proposalId") || ""));
    if (!setup || setup.kind !== "EVENT_IMPORT_SETUP") return error("Revisão não encontrada. Leia a referência novamente.", 409);
    const settings = field("settings");
    if (!settings || typeof settings !== "object") return error("Preencha as informações da importação.");
    const parsed = importPlanSchema.safeParse({ ...settings, source: setup.source });
    if (!parsed.success) return error(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
    if ((await findImportDuplicates(admin.organizationId, { ...setup.source, city: parsed.data.city })).length) return error("Já existe um evento correspondente. Nenhuma duplicata será criada.", 409);
    if (!await claimAssistantResolution(admin, setup.id, "ADMIN_ASSISTANT_PROCESSING")) return error("Esta revisão já foi processada. Atualize a conversa.", 409);
    const row = await prisma.adminAuditLog.create({ data: { adminUserId: admin.id, action: "ADMIN_ASSISTANT_PROPOSAL", entityType: "ADMIN_ASSISTANT", metadata: JSON.parse(JSON.stringify({ kind: "EVENT_IMPORT", organizationId: admin.organizationId, plan: parsed.data })) } });
    const proposal: ImportProposal = { kind: "EVENT_IMPORT", id: row.id, eventId: "", eventTitle: parsed.data.source.title, plan: parsed.data };
    return NextResponse.json({ proposal });
  }
  if (field("type") === "confirm") {
    if (!canAccessArea(admin.role, "EVENTS")) return error("Seu perfil pode consultar o assistente, mas não alterar eventos ou ingressos.", 403);
    const proposalId = String(field("proposalId") || "").trim();
    if (!proposalId) return error("Proposta não informada.");
    const proposal = await getAssistantProposal(admin, proposalId);
    if (!proposal) return error("Proposta não encontrada ou sem autorização.", 404);
    if (proposal.kind === "EVENT_IMPORT_SETUP") return error("Complete a revisão antes de confirmar.");
    if (proposal.kind === "EVENT_IMPORT" && admin.role !== "OWNER") return error("A importação exige acesso de proprietário.", 403);
    if (proposal.kind !== "EVENT_CREATE" && proposal.kind !== "EVENT_IMPORT" && !canAccessEvent(admin, proposal.eventId)) return error("Você não tem acesso a este evento.", 403);
    const previouslyResolved = await prisma.adminAuditLog.findFirst({ where: { action: { in: ["ADMIN_ASSISTANT_APPLIED", "ADMIN_ASSISTANT_DISCARDED"] }, entityType: "ADMIN_ASSISTANT", entityId: proposal.id }, select: { id: true } });
    if (previouslyResolved) return error("Esta proposta já foi concluída ou cancelada.", 409);
    if (!await claimAssistantResolution(admin, proposal.id, "ADMIN_ASSISTANT_PROCESSING")) return error("Esta proposta já foi processada ou está em processamento. Confira o resultado; se houve falha, solicite uma nova proposta.", 409);
    if (proposal.kind === "EVENT_IMPORT") {
      try {
        const imported = await executeEventImport(admin.organizationId, proposal.id, proposal.plan);
        revalidatePath("/admin/events"); revalidatePath(`/evento/${imported.slug}`); revalidatePath("/");
        const publicCheck = await verifyImportedPublicPage(admin.organizationId, imported.slug, proposal.plan);
        const text = `Importação salva e conferida no banco: ${proposal.eventTitle}. ID ${imported.id}. ${proposal.plan.source.tickets.length} tipos de ingresso. Status ${imported.status}. ${proposal.plan.source.mapUrl ? "Banner e mapa copiados e verificados por conteúdo." : "Banner copiado e verificado; ausência de mapa confirmada pelo operador."} ${publicCheck.detail} ${proposal.plan.publish ? publicCheck.url : ""}${publicCheck.ok ? "" : " A verificação pública está pendente; não repita a criação."}`;
        const message = await saveAssistantConfirmation(admin, proposal, text);
        return NextResponse.json({ message, verificationPending: !publicCheck.ok });
      } catch (cause) {
        const committed = await prisma.adminAuditLog.findUnique({ where: { id: `assistant-import-result:${proposal.id}` }, select: { metadata: true } });
        if (committed) return error("O cadastro foi salvo, mas a resposta final falhou. Confira Congressos e eventos; não repita a importação.", 503);
        console.error("[admin-assistant] Importação não concluída", cause);
        const safeMessage = cause instanceof Error && /^(A fonte|Já existe|Outro cadastro|A data|Configure armazenamento|A mídia|A imagem|Mídia local|Imagem acima|Use mídia|Tempo excedido|Cadastro não|Ingresso divergente|O pixel)/.test(cause.message)
          ? cause.message : "Importação não confirmada. Nenhum evento parcial foi publicado. Confira o histórico antes de tentar novamente.";
        return error(safeMessage, 409);
      }
    }
    if (proposal.kind === "EVENT_CREATE") {
      const draft = proposal.draft;
      const start = validateAssistantEventValue("startsAt", draft.startsAt);
      const banner = validateAssistantEventValue("bannerUrl", draft.bannerUrl);
      const map = validateAssistantEventValue("eventMapImageUrl", draft.eventMapImageUrl);
      const parsed = eventDraftSchema.safeParse({ ...draft, startsAt: start, bannerUrl: banner, eventMapImageUrl: map });
      if (!start || banner === null || map === null || !parsed.success) return error("Dados do rascunho inválidos; solicite uma nova proposta.");
      if (await prisma.event.findFirst({ where: { organizationId: admin.organizationId, slug: parsed.data.slug }, select: { id: true } })) return error("Já existe um evento com este endereço. Solicite outro slug.", 409);
      try {
        const event = await createEvent({ ...parsed.data, status: "DRAFT" }, admin.organizationId);
        const verified = await prisma.event.findUnique({ where: { id: event.id }, select: { id: true, title: true, slug: true, status: true } });
        if (!verified || verified.status !== "DRAFT" || verified.title !== draft.title) throw new Error("Rascunho não confirmado após a gravação.");
        revalidatePath("/admin/events");
        revalidatePath(`/admin/events/${event.id}`);
        const text = `Rascunho criado e confirmado: ${verified.title}. ID ${verified.id}. Ele não foi publicado; revise banner, mapa, ingressos e informações antes de colocá-lo no ar.`;
        const message = await saveAssistantConfirmation(admin, proposal, text);
        return NextResponse.json({ message });
      } catch (cause) {
        console.error("[admin-assistant] Falha ao criar evento", cause);
        return error("Não consegui confirmar o cadastro do rascunho. Confira a lista de eventos antes de tentar novamente.", 503);
      }
    }
    if (proposal.kind === "EVENT_DETAILS_CHANGE") {
      const event = await prisma.event.findFirst({ where: { id: proposal.eventId, organizationId: admin.organizationId },
        select: { id: true, slug: true, title: true, updatedAt: true, startsAt: true, endsAt: true, doorsOpenAt: true, salesStartsAt: true, salesEndsAt: true, bannerUrl: true, eventMapImageUrl: true } });
      if (!event) return error("Evento não encontrado.", 404);
      if (event.updatedAt.toISOString() !== proposal.expectedUpdatedAt) return error("O evento mudou desde a proposta. Peça uma nova conferência.", 409);
      const data: Prisma.EventUpdateManyMutationInput = {};
      for (const change of proposal.changes) {
        let value = validateAssistantEventValue(change.field, change.value);
        if (value === null && ["bannerUrl", "eventMapImageUrl"].includes(change.field) && /^assistant-image:[a-z0-9]+$/.test(change.value)) {
          const image = await getAssistantImage(admin, change.value.slice("assistant-image:".length));
          if (!image) return error("A imagem anexada não está mais disponível.", 404);
          try {
            const extension = image.mime === "image/png" ? "png" : image.mime === "image/webp" ? "webp" : "jpg";
            value = await savePublicImageUpload(new File([new Uint8Array(image.bytes)], `assistente.${extension}`, { type: image.mime }),
              `events/${event.slug}/${change.field === "bannerUrl" ? "banner" : "map"}`);
          } catch (cause) {
            console.error("[admin-assistant] Falha ao enviar imagem", cause);
            return error("Não consegui salvar a imagem. Nenhuma alteração do evento foi feita.", 503);
          }
        }
        if (value === null) return error("Campo proposto inválido.");
        if (["startsAt", "doorsOpenAt", "endsAt", "salesStartsAt", "salesEndsAt"].includes(change.field)) {
          (data as Record<string, unknown>)[change.field] = value ? new Date(value) : null;
        } else {
          (data as Record<string, unknown>)[change.field] = value || (["title", "venueName", "venueAddress", "city", "state"].includes(change.field) ? value : null);
        }
      }
      const nextStart = data.startsAt instanceof Date ? data.startsAt : event.startsAt;
      const nextEnd = "endsAt" in data ? (data.endsAt instanceof Date ? data.endsAt : null) : event.endsAt;
      if (nextEnd && nextEnd < nextStart) return error("O fim do evento não pode ser anterior ao início.");
      const nextSalesStart = "salesStartsAt" in data ? (data.salesStartsAt instanceof Date ? data.salesStartsAt : null) : event.salesStartsAt;
      const nextSalesEnd = "salesEndsAt" in data ? (data.salesEndsAt instanceof Date ? data.salesEndsAt : null) : event.salesEndsAt;
      if (nextSalesStart && nextSalesEnd && nextSalesEnd < nextSalesStart) return error("O fim das vendas não pode ser anterior ao início.");
      try {
        const updated = await prisma.event.updateMany({ where: { id: event.id, organizationId: admin.organizationId, updatedAt: event.updatedAt }, data });
        if (updated.count !== 1) return error("O evento mudou durante a confirmação. Peça uma nova conferência.", 409);
        const verified = await prisma.event.findUnique({ where: { id: event.id }, select: { id: true, slug: true, title: true, subtitle: true, description: true, startsAt: true, doorsOpenAt: true, endsAt: true, salesStartsAt: true, salesEndsAt: true, venueName: true, venueAddress: true, city: true, state: true, bannerUrl: true, eventMapImageUrl: true, eventMapNotes: true, eventMapTemplate: true, googleMapsUrl: true, importantInfo: true, seoTitle: true, seoDescription: true, seoKeywords: true, seoImageUrl: true, supportWhatsappUrl: true, conversionSocialProofText: true, conversionUrgencyText: true, conversionCtaText: true } });
        if (!verified || proposal.changes.some((change) => {
          const actual = verified[change.field];
          return (actual instanceof Date ? actual.toISOString() : String(actual ?? "")) !==
            (change.value.startsWith("assistant-image:") ? String((data as Record<string, unknown>)[change.field] ?? "") : change.value);
        })) throw new Error("Alteração não confirmada após a gravação.");
        revalidatePath("/admin/events");
        revalidatePath(`/admin/events/${event.id}`);
        revalidatePath("/");
        revalidatePath("/sitemap.xml");
        for (const slug of new Set([event.slug, verified.slug])) {
          revalidatePath(`/evento/${slug}`);
          revalidatePath(`/evento/${slug}/checkout`);
        }
        const text = `Alteração confirmada em ${verified.title}: ${proposal.changes.map((change) => change.field).join(", ")}. Conferi os valores salvos no sistema.`;
        const message = await saveAssistantConfirmation(admin, proposal, text);
        return NextResponse.json({ message });
      } catch (cause) {
        console.error("[admin-assistant] Falha ao alterar detalhes do evento", cause);
        return error("Não consegui confirmar todos os dados do evento. Confira o painel antes de tentar novamente.", 503);
      }
    }
    if (proposal.kind === "LOT_ORDER_CHANGE") {
      const event = await prisma.event.findFirst({ where: { id: proposal.eventId, organizationId: admin.organizationId },
        select: { id: true, slug: true, title: true } });
      if (!event) return error("Evento não encontrado.", 404);
      try {
        const verified = await applyAssistantLotOrder(event.id, proposal.expectedIds, proposal.desiredIds);
        revalidatePath(`/evento/${event.slug}`);
        revalidatePath(`/evento/${event.slug}/checkout`);
        revalidatePath(`/admin/events/${event.id}/lots`);
        const text = `Ordem gravada e conferida no banco para ${event.title}: ${verified.length} ingressos visíveis, sem posições repetidas. O cache da página pública foi invalidado; confira a sequência nela antes de considerar a atualização concluída. Preços, estoques, cores, status e vendas foram preservados.`;
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
        await updateEventStatus(event.id, proposal.newStatus, proposal.oldStatus);
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
      await updateTicketLotPricing(lot.id, pricing.data, proposal.oldPriceInCents);
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
    if (!await discardAssistantProposal(admin, proposalId)) return error("A proposta já foi cancelada, está em processamento ou não está mais disponível.", 409);
    return NextResponse.json({ ok: true });
  }
  return error("Operação não reconhecida.");
}
