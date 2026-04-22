import { NextResponse } from "next/server";
import { requirePermission } from "@/features/auth/auth.service";
import { getEventForManagement } from "@/features/events/event.service";
import { listEventLeads } from "@/features/leads/lead.service";

function csvValue(value: unknown) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  await requirePermission("EVENTS");
  const { eventId } = await params;
  const event = await getEventForManagement(eventId);

  if (!event) {
    return new NextResponse("Evento não encontrado.", { status: 404 });
  }

  const leads = await listEventLeads(event.id);

  const headers = [
    "Nome",
    "E-mail",
    "Telefone",
    "Evento",
    "Cidade",
    "UF",
    "UTM source",
    "UTM medium",
    "UTM campaign",
    "UTM content",
    "UTM term",
    "Referrer",
    "Landing",
    "Cadastrado em"
  ];
  const rows = leads.map((lead) => [
    lead.name,
    lead.email,
    lead.phone || "",
    event.title,
    event.city,
    event.state,
    lead.utmSource || "",
    lead.utmMedium || "",
    lead.utmCampaign || "",
    lead.utmContent || "",
    lead.utmTerm || "",
    lead.referrer || "",
    lead.landingPage || "",
    formatDate(lead.createdAt)
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(";")).join("\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tcr-leads-${event.slug}-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
