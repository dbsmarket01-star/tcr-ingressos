import { NextResponse } from "next/server";
import { requirePermission } from "@/features/auth/auth.service";
import { getEventForManagement } from "@/features/events/event.service";
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
  const municipalityRanking = Array.from(
    leads.reduce((acc, lead) => {
      const key = lead.municipality?.trim() || "Não informado";
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map<string, number>())
  ).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"));

  const headers = [
    "Nome completo",
    "E-mail",
    "Código do país",
    "DDD",
    "Telefone",
    "Evento",
    "Município do lead",
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
      phone.countryCode,
      phone.areaCode,
      phone.localNumber,
      event.title,
      lead.municipality || "",
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

  const municipalitySummaryHeader = ["Resumo por município", "Quantidade de leads"];
  const municipalitySummaryRows = municipalityRanking.map(([municipality, count]) => [municipality, count]);
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
