"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/features/audit/audit.service";
import { requirePermission } from "@/features/auth/auth.service";
import { getOrganizationBrandingById } from "@/features/organizations/organization.service";
import { updateOrganizationLogo } from "@/features/organizations/organization.admin.service";
import { savePublicImageUpload } from "@/features/uploads/local-upload.service";
import { companySettingsSchema } from "./company-settings.schema";
import { updateCompanySettings } from "./company-settings.service";
import { splitRuleFormSchema } from "./split-settings.schema";
import { replacePaymentSplitRules } from "./split-settings.service";

function settingsValidationMessage() {
  return "Verifique nome da empresa, documento, e-mail, taxa padrão e links sociais.";
}

function normalizeDecimal(value: FormDataEntryValue | null) {
  return String(value ?? "0").trim().replace(",", ".");
}

function normalizeUrlLike(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function withHttps(value: string) {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function normalizeInstagramUrl(raw: string) {
  const value = raw.trim();

  if (!value) {
    return "";
  }

  if (value.startsWith("@")) {
    return `https://instagram.com/${value.slice(1)}`;
  }

  if (!value.includes("/") && !value.includes(".")) {
    return `https://instagram.com/${value}`;
  }

  return withHttps(value);
}

function normalizeFacebookUrl(raw: string) {
  const value = raw.trim();

  if (!value) {
    return "";
  }

  if (value.startsWith("@")) {
    return `https://facebook.com/${value.slice(1)}`;
  }

  if (!value.includes("/") && !value.includes(".")) {
    return `https://facebook.com/${value}`;
  }

  return withHttps(value);
}

function normalizeYoutubeUrl(raw: string) {
  const value = raw.trim();

  if (!value) {
    return "";
  }

  if (value.startsWith("@")) {
    return `https://youtube.com/${value}`;
  }

  if (!value.includes("/") && !value.includes(".")) {
    return `https://youtube.com/@${value}`;
  }

  return withHttps(value);
}

function normalizeWhatsappUrl(raw: string) {
  const value = raw.trim();

  if (!value) {
    return "";
  }

  if (/^\+?\d+$/.test(value.replace(/\s+/g, ""))) {
    return `https://wa.me/${value.replace(/\D/g, "")}`;
  }

  return withHttps(value);
}

export async function updateCompanySettingsAction(formData: FormData) {
  const admin = await requirePermission("SETTINGS");

  const parsed = companySettingsSchema.safeParse({
    companyName: String(formData.get("companyName") ?? ""),
    tradeName: String(formData.get("tradeName") ?? ""),
    document: String(formData.get("document") ?? ""),
    supportEmail: String(formData.get("supportEmail") ?? ""),
    supportPhone: String(formData.get("supportPhone") ?? "") || undefined,
    instagramUrl: normalizeInstagramUrl(normalizeUrlLike(formData.get("instagramUrl"))),
    facebookUrl: normalizeFacebookUrl(normalizeUrlLike(formData.get("facebookUrl"))),
    youtubeUrl: normalizeYoutubeUrl(normalizeUrlLike(formData.get("youtubeUrl"))),
    whatsappUrl: normalizeWhatsappUrl(normalizeUrlLike(formData.get("whatsappUrl"))),
    defaultCurrency: String(formData.get("defaultCurrency") ?? "BRL"),
    platformFeePercent: normalizeDecimal(formData.get("platformFeePercent")),
    orderReservationMinutes: String(formData.get("orderReservationMinutes") ?? "120"),
    cardPendingReservationMinutes: String(formData.get("cardPendingReservationMinutes") ?? "30")
  });

  if (!parsed.success) {
    redirect(`/admin/settings?error=${encodeURIComponent(settingsValidationMessage())}`);
  }

  const settings = await updateCompanySettings(parsed.data);

  await createAuditLog({
    adminUserId: admin.id,
    action: "COMPANY_SETTINGS_UPDATED",
    entityType: "CompanySettings",
    entityId: settings.id,
    metadata: {
      companyName: settings.companyName,
      supportEmail: settings.supportEmail
    }
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/audit");
  revalidatePath("/");
  redirect("/admin/settings?saved=1");
}

export async function updatePaymentSplitRulesAction(formData: FormData) {
  const admin = await requirePermission("SETTINGS");
  const rules = Array.from({ length: 6 }).map((_, index) => {
    const parsed = splitRuleFormSchema.safeParse({
      name: String(formData.get(`splitName_${index}`) ?? ""),
      walletId: String(formData.get(`splitWalletId_${index}`) ?? ""),
      type: String(formData.get(`splitType_${index}`) ?? "PERCENTAGE"),
      value: normalizeDecimal(formData.get(`splitValue_${index}`)),
      isActive: formData.get(`splitActive_${index}`) === "on",
      sortOrder: index
    });

    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  }).filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));

  const savedRules = await replacePaymentSplitRules(rules);

  await createAuditLog({
    adminUserId: admin.id,
    action: "PAYMENT_SPLIT_RULES_UPDATED",
    entityType: "PaymentSplitRule",
    metadata: {
      activeRules: savedRules.filter((rule) => rule.isActive).length,
      totalRules: savedRules.length
    }
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/production");
  revalidatePath("/admin/audit");
  redirect("/admin/settings?splitSaved=1");
}

export async function updateOrganizationLogoAction(formData: FormData) {
  const admin = await requirePermission("SETTINGS");

  if (!admin.organizationId) {
    redirect("/admin/settings?error=Organizacao%20nao%20encontrada.");
  }

  const organization = await getOrganizationBrandingById(admin.organizationId);

  if (!organization) {
    redirect("/admin/settings?error=Organizacao%20nao%20encontrada.");
  }

  let logoUploadUrl: string | null = null;

  try {
    logoUploadUrl = await savePublicImageUpload(
      formData.get("organizationLogoFile") as File | null,
      `organizations/${organization.slug || organization.id}/logo`
    );
  } catch (error) {
    redirect(
      `/admin/settings?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Nao foi possivel salvar a logo."
      )}`
    );
  }

  const fallbackUrl = String(formData.get("organizationLogoUrl") ?? "").trim() || null;
  const nextLogoUrl = logoUploadUrl || fallbackUrl;

  const updatedOrganization = await updateOrganizationLogo(admin.organizationId, nextLogoUrl);

  await createAuditLog({
    adminUserId: admin.id,
    action: "ORGANIZATION_LOGO_UPDATED",
    entityType: "Organization",
    entityId: updatedOrganization.id,
    metadata: {
      logoUrl: updatedOrganization.logoUrl
    }
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/login");
  revalidatePath("/");
  redirect("/admin/settings?brandingSaved=1");
}
