"use server";

import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/features/audit/audit.service";
import { requirePermission } from "@/features/auth/auth.service";
import {
  createOrganization,
  updateOrganization,
  updateOrganizationStatus
} from "@/features/organizations/organization.admin.service";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createOrganizationAction(formData: FormData) {
  const admin = await requirePermission("OPERATIONS");
  const name = readText(formData, "name");
  const slug = readText(formData, "slug");
  const ownerName = readText(formData, "ownerName");
  const ownerEmail = readText(formData, "ownerEmail");
  const ownerPassword = readText(formData, "ownerPassword");

  if (name.length < 2) {
    throw new Error("Informe o nome da operação.");
  }

  if (ownerName.length < 2 || !ownerEmail.includes("@") || ownerPassword.length < 8) {
    throw new Error("Informe nome, e-mail e senha inicial do cliente com pelo menos 8 caracteres.");
  }

  const organization = await createOrganization({
    name,
    slug,
    publicDomain: readText(formData, "publicDomain"),
    adminDomain: readText(formData, "adminDomain"),
    logoUrl: readText(formData, "logoUrl"),
    primaryColor: readText(formData, "primaryColor"),
    secondaryColor: readText(formData, "secondaryColor"),
    supportEmail: readText(formData, "supportEmail"),
    supportPhone: readText(formData, "supportPhone"),
    ownerName,
    ownerEmail,
    ownerPassword
  });

  await createAuditLog({
    adminUserId: admin.id,
    action: "ORGANIZATION_CREATED",
    entityType: "Organization",
    entityId: organization.id,
    metadata: {
      name: organization.name,
      slug: organization.slug,
      publicDomain: organization.publicDomain,
      adminDomain: organization.adminDomain,
      primaryColor: organization.primaryColor,
      secondaryColor: organization.secondaryColor
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/operations");
  revalidatePath("/");
  revalidatePath("/login");
}

export async function updateOrganizationAction(formData: FormData) {
  const admin = await requirePermission("OPERATIONS");
  const id = readText(formData, "organizationId");
  const name = readText(formData, "name");

  if (!id || name.length < 2) {
    throw new Error("Operação inválida.");
  }

  const organization = await updateOrganization({
    id,
    name,
    publicDomain: readText(formData, "publicDomain"),
    adminDomain: readText(formData, "adminDomain"),
    logoUrl: readText(formData, "logoUrl"),
    primaryColor: readText(formData, "primaryColor"),
    secondaryColor: readText(formData, "secondaryColor"),
    supportEmail: readText(formData, "supportEmail"),
    supportPhone: readText(formData, "supportPhone")
  });

  await createAuditLog({
    adminUserId: admin.id,
    action: "ORGANIZATION_UPDATED",
    entityType: "Organization",
    entityId: organization.id,
    metadata: {
      name: organization.name,
      publicDomain: organization.publicDomain,
      adminDomain: organization.adminDomain,
      primaryColor: organization.primaryColor,
      secondaryColor: organization.secondaryColor
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/operations");
  revalidatePath("/");
  revalidatePath("/login");
}

export async function updateOrganizationStatusAction(formData: FormData) {
  const admin = await requirePermission("OPERATIONS");
  const id = readText(formData, "organizationId");
  const isActive = readText(formData, "isActive") === "true";

  if (!id) {
    throw new Error("Operação inválida.");
  }

  const organization = await updateOrganizationStatus(id, isActive);

  await createAuditLog({
    adminUserId: admin.id,
    action: isActive ? "ORGANIZATION_ACTIVATED" : "ORGANIZATION_DEACTIVATED",
    entityType: "Organization",
    entityId: organization.id,
    metadata: {
      name: organization.name
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/operations");
  revalidatePath("/");
  revalidatePath("/login");
}
