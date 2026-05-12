"use server";

import { HomeListStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { updateHomeListEntry } from "./home-list.service";

function parseDateField(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();
  const date = new Date(`${text}T00:00:00.000Z`);

  if (!text || Number.isNaN(date.getTime())) {
    throw new Error(`Informe ${label}.`);
  }

  return date;
}

function parseStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? "").trim();

  if (status === HomeListStatus.CONFIRMED || status === HomeListStatus.PENDING || status === HomeListStatus.CANCELED) {
    return status;
  }

  throw new Error("Status de hospedagem inválido.");
}

function requiredText(formData: FormData, field: string, label: string) {
  const value = String(formData.get(field) ?? "").trim();

  if (!value) {
    throw new Error(`Informe ${label}.`);
  }

  return value;
}

export async function updateHomeListEntryAction(formData: FormData) {
  const admin = await requirePermission("REPORTS");
  const entryId = String(formData.get("entryId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/admin/home-list").trim();

  if (!entryId) {
    redirect(`/admin/home-list?error=${encodeURIComponent("Registro nao informado.")}`);
  }

  try {
    await updateHomeListEntry(
      entryId,
      admin.organizationId,
      {
        status: parseStatus(formData.get("status")),
        roomNumber: String(formData.get("roomNumber") ?? "").trim() || null,
        notes: String(formData.get("notes") ?? "").trim() || null,
        guest1Name: requiredText(formData, "guest1Name", "o nome do hóspede principal"),
        guest1Document: requiredText(formData, "guest1Document", "o CPF do hóspede principal"),
        guest1BirthDate: parseDateField(formData.get("guest1BirthDate"), "a data de nascimento do hóspede principal"),
        guest1Email: requiredText(formData, "guest1Email", "o e-mail do hóspede principal"),
        guest1Phone: requiredText(formData, "guest1Phone", "o telefone do hóspede principal"),
        guest2Name: requiredText(formData, "guest2Name", "o nome do acompanhante"),
        guest2Document: requiredText(formData, "guest2Document", "o CPF do acompanhante"),
        guest2BirthDate: parseDateField(formData.get("guest2BirthDate"), "a data de nascimento do acompanhante")
      },
      getAdminAllowedEventIds(admin)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel atualizar a HOME LIST.";
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/home-list");
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=1`);
}
