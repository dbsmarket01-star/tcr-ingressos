import { HomeListStatus } from "@prisma/client";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { listHomeListEntriesForExport } from "@/features/hospitality/home-list.service";
import { formatDateInput } from "@/lib/format";

export const dynamic = "force-dynamic";

function parseStatus(value: string | null) {
  if (value === HomeListStatus.PENDING || value === HomeListStatus.CONFIRMED || value === HomeListStatus.CANCELED) {
    return value;
  }

  return null;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const admin = await requirePermission("REPORTS");
  const { searchParams } = new URL(request.url);
  const entries = await listHomeListEntriesForExport(
    admin.organizationId,
    {
      eventId: searchParams.get("eventId"),
      hotelId: searchParams.get("hotelId"),
      status: parseStatus(searchParams.get("status")),
      search: searchParams.get("search")
    },
    getAdminAllowedEventIds(admin)
  );

  const headers = [
    "Evento",
    "Hotel",
    "Quarto",
    "Hospede 1 - nome",
    "Hospede 1 - CPF",
    "Hospede 1 - nascimento",
    "Hospede 1 - e-mail",
    "Hospede 1 - telefone",
    "Hospede 2 - nome",
    "Hospede 2 - CPF",
    "Hospede 2 - nascimento",
    "Observacoes"
  ];

  const rows = entries.map((entry) => [
    entry.event.title,
    `${entry.hotel.name} - ${entry.hotel.city}/${entry.hotel.state}`,
    entry.roomNumber ?? "",
    entry.guest1Name,
    entry.guest1Document,
    formatDateInput(entry.guest1BirthDate),
    entry.guest1Email,
    entry.guest1Phone,
    entry.guest2Name,
    entry.guest2Document,
    formatDateInput(entry.guest2BirthDate),
    entry.notes ?? ""
  ]);

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  </body>
</html>`;

  return new Response(`\ufeff${html}`, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="home-list.xls"`
    }
  });
}
