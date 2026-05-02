import { NextResponse } from "next/server";
import { requirePermission } from "@/features/auth/auth.service";
import { getEventForManagement } from "@/features/events/event.service";
import { getMunicipalityRanking } from "@/features/leads/lead-normalization";
import { listEventLeads } from "@/features/leads/lead.service";
import { formatDateTime } from "@/lib/format";

function csvValue(value: unknown) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatDate(value: Date) {
  return formatDateTime(value);
}

function splitPhoneParts(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");

  if (!digits) {
    return {
      countryCode: "",
      areaCode: "",
      localNumber: ""
    };
  }

  const normalized = digits.length <= 11 ? `55${digits}` : digits;
  const countryCode = normalized.slice(0, normalized.length - 11);
  const areaCode = normalized.slice(-11, -9);
  const localNumber = normalized.slice(-9);

  return {
    countryCode,
    areaCode,
    localNumber
  };
}

function getNormalizedPhone(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("00") && digits.length > 4) {
    return digits.slice(2);
  }

  if (digits.length <= 11) {
    return `55${digits}`;
  }

  return digits;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  const event = await getEventForManagement(eventId, admin.organizationId!);

  if (!event) {
    return new NextResponse("Evento não encontrado.", { status: 404 });
  }

  const leads = await listEventLeads(event.id);
  const municipalityRanking = getMunicipalityRanking(leads.map((lead) => lead.municipality));

  const headers = [
    "Nome completo",
    "E-mail",
    "Telefone completo",
    "Código do país",
    "DDD",
    "Telefone",
    "Evento",
    "Município do lead",
    "Viu obrigado",
    "Clicou no grupo",
    "Cliques no grupo",
    "Cidade do evento",
    "UF do evento",
    "UTM source",
    "UTM medium",
    "UTM campaign",
    "UTM content",
    "UTM term",
    "Referrer",
    "Landing",
    "Cadastrado em"
  ];
  const rows = leads.map((lead) => {
    const phone = splitPhoneParts(lead.phone);

    return [
      lead.name,
      lead.email,
      getNormalizedPhone(lead.phone),
      phone.countryCode,
      phone.areaCode,
      phone.localNumber,
      event.title,
      lead.municipality || "",
      lead.thankYouViewedAt ? "Sim" : "Não",
      lead.whatsappClickedAt ? "Sim" : "Não",
      String(lead.whatsappClickCount ?? 0),
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
    ];
  });

  const municipalitySummaryHeader = ["Resumo por município", "Quantidade de leads", "Percentual"];
  const municipalitySummaryRows = municipalityRanking.map((entry) => [
    entry.label,
    entry.count,
    `${Math.round((entry.count / Math.max(leads.length, 1)) * 100)}%`
  ]);
  const csv = [
    [headers, ...rows].map((row) => row.map(csvValue).join(";")).join("\n"),
    [municipalitySummaryHeader, ...municipalitySummaryRows].map((row) => row.map(csvValue).join(";")).join("\n")
  ].join("\n\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tcr-leads-${event.slug}-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
