"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { platformLeadSchema } from "./platform-lead.schema";
import { createOrUpdatePlatformLead } from "./platform-lead.service";

function validationMessage(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = error.issues as Array<{ path?: Array<string | number> }>;
    const field = issues[0]?.path?.[0];

    const fieldLabels: Record<string, string> = {
      name: "nome",
      email: "e-mail",
      phone: "telefone",
      annualRevenueBand: "faturamento anual",
      instagramHandle: "Instagram",
      eventNiche: "nicho dos eventos"
    };

    if (typeof field === "string") {
      return `Verifique o campo ${fieldLabels[field] || field}.`;
    }
  }

  return "Revise os dados e tente novamente.";
}

export async function createPlatformLeadAction(formData: FormData) {
  const parsed = platformLeadSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    annualRevenueBand: String(formData.get("annualRevenueBand") ?? "").trim(),
    instagramHandle: String(formData.get("instagramHandle") ?? "").trim() || undefined,
    eventNiche: String(formData.get("eventNiche") ?? "").trim()
  });

  if (!parsed.success) {
    redirect(`/?error=${encodeURIComponent(validationMessage(parsed.error))}#quero-minha-bilheteria`);
  }

  try {
    const result = await createOrUpdatePlatformLead(parsed.data);
    revalidatePath("/");
    revalidatePath("/admin");

    if (result.isExisting) {
      redirect("/?success=existing#quero-minha-bilheteria");
    }
  } catch (error) {
    redirect(
      `/?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível registrar seu interesse agora.")}#quero-minha-bilheteria`
    );
  }

  redirect("/?success=created#quero-minha-bilheteria");
}
