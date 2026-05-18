"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/features/auth/auth.service";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import { createNumberedSeatMapForEvent, createRestaurantSeatMapForEvent } from "./seat-map.service";
import type { SeatMapKind, SeatMapTableShape } from "./seat-map";

function parseSeatMapKind(value: FormDataEntryValue | null): SeatMapKind {
  const text = String(value ?? "").trim();

  if (text === "THEATER" || text === "ARENA" || text === "OVAL" || text === "RESTAURANT" || text === "CUSTOM") {
    return text;
  }

  return "RESTAURANT";
}

function parseTableShape(value: FormDataEntryValue | null): SeatMapTableShape {
  const text = String(value ?? "").trim();

  if (text === "SQUARE" || text === "RECTANGLE") {
    return text;
  }

  return "ROUND";
}

function parseSeatsPerTable(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 4);

  if (!Number.isFinite(parsed)) {
    return 4;
  }

  return Math.min(20, Math.max(1, Math.round(parsed)));
}

function parseTablesPerSection(value: FormDataEntryValue | null) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(500, Math.max(1, Math.round(parsed)));
}

export async function applyNumberedSeatMapAction(formData: FormData) {
  const admin = await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();

  if (!eventId) {
    redirect("/admin/seat-maps?error=Evento inválido para aplicar mapa numerado.");
  }

  const kind = parseSeatMapKind(formData.get("mapKind"));
  const selectedSeatingMode = String(formData.get("seatingMode") ?? "WITH_TABLES") === "SEATS_ONLY" ? "SEATS_ONLY" : "WITH_TABLES";
  const seatingMode = kind === "RESTAURANT" || kind === "CUSTOM" ? selectedSeatingMode : "SEATS_ONLY";
  const seatsPerTable = parseSeatsPerTable(formData.get("seatsPerTable"));
  const tablesPerSection = parseTablesPerSection(formData.get("tablesPerSection"));
  const tableShape = parseTableShape(formData.get("tableShape"));

  try {
    await createNumberedSeatMapForEvent(eventId, admin.organizationId, {
      kind,
      seatingMode,
      seatsPerTable,
      tablesPerSection: seatingMode === "WITH_TABLES" ? tablesPerSection : null,
      tableShape
    });
  } catch (error) {
    const message = getFriendlyErrorMessage(error, "Não foi possível aplicar o mapa numerado.");
    redirect(`/admin/events/${eventId}/seat-map?error=${encodeURIComponent(message)}`);
  }

  redirect(`/admin/events/${eventId}/seat-map?success=${encodeURIComponent("Mapa numerado aplicado ao evento com sucesso.")}`);
}

export async function generateRestaurantSeatMapAction(formData: FormData) {
  const admin = await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();

  if (!eventId) {
    redirect("/admin/events?error=Evento inválido para gerar mapa numerado.");
  }

  try {
    await createRestaurantSeatMapForEvent(eventId, admin.organizationId);
  } catch (error) {
    const message = getFriendlyErrorMessage(error, "Não foi possível gerar o mapa numerado.");
    redirect(`/admin/events/${eventId}/seat-map?error=${encodeURIComponent(message)}`);
  }

  redirect(`/admin/events/${eventId}/seat-map?success=${encodeURIComponent("Mapa numerado gerado com sucesso.")}`);
}
