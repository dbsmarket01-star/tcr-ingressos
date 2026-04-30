"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/features/audit/audit.service";
import { requirePermission } from "@/features/auth/auth.service";
import {
  createOrganizationInitialOwner,
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
    redirect(
      `/admin/operations?error=${encodeURIComponent(
        "Informe nome, e-mail e senha inicial do cliente com pelo menos 8 caracteres."
      )}`
    );
  }

  let organization: Awaited<ReturnType<typeof createOrganization>>;

  try {
    organization = await createOrganization({
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
  } catch (error) {
    redirect(
      `/admin/operations?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Não foi possível criar o cliente."
      )}`
    );
  }

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
  redirect(`/admin/operations?created=${encodeURIComponent(organization.name)}`);
}

export async function updateOrganizationAction(formData: FormData) {
  const admin = await requirePermission("OPERATIONS");
  const id = readText(formData, "organizationId");
  const name = readText(formData, "name");

  if (!id || name.length < 2) {
    throw new Error("Operação inválida.");
  }

  let organization: Awaited<ReturnType<typeof updateOrganization>>;

  try {
    organization = await updateOrganization({
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
  } catch (error) {
    redirect(
      `/admin/operations?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Não foi possível atualizar o cliente."
      )}`
    );
  }

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
  redirect(`/admin/operations?updated=${encodeURIComponent(organization.name)}`);
}

export async function updateOrganizationStatusAction(formData: FormData) {
  const admin = await requirePermission("OPERATIONS");
  const id = readText(formData, "organizationId");
  const isActive = readText(formData, "isActive") === "true";

  if (!id) {
    throw new Error("Operação inválida.");
  }

  let organization: Awaited<ReturnType<typeof updateOrganizationStatus>>;

  try {
    organization = await updateOrganizationStatus(id, isActive);
  } catch (error) {
    redirect(
      `/admin/operations?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Não foi possível atualizar o status do cliente."
      )}`
    );
  }

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
  redirect(
    `/admin/operations?updated=${encodeURIComponent(
      `${organization.name} ${isActive ? "ativada" : "desativada"}`
    )}`
  );
}

export async function createOrganizationInitialOwnerAction(formData: FormData) {
  const admin = await requirePermission("OPERATIONS");
  const organizationId = readText(formData, "organizationId");
  const ownerName = readText(formData, "ownerName");
  const ownerEmail = readText(formData, "ownerEmail");
  const ownerPassword = readText(formData, "ownerPassword");

  if (!organizationId || ownerName.length < 2 || !ownerEmail.includes("@") || ownerPassword.length < 8) {
    redirect(
      `/admin/operations/${organizationId}?error=${encodeURIComponent(
        "Informe nome, e-mail e senha inicial com pelo menos 8 caracteres."
      )}`
    );
  }

  let result: Awaited<ReturnType<typeof createOrganizationInitialOwner>>;

  try {
    result = await createOrganizationInitialOwner({
      organizationId,
      name: ownerName,
      email: ownerEmail,
      password: ownerPassword
    });
  } catch (error) {
    redirect(
      `/admin/operations/${organizationId}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Não foi possível liberar o acesso inicial da operação."
      )}`
    );
  }

  await createAuditLog({
    adminUserId: admin.id,
    action: "ORGANIZATION_INITIAL_OWNER_CREATED",
    entityType: "Organization",
    entityId: result.organization.id,
    metadata: {
      organizationName: result.organization.name,
      ownerEmail: result.adminUser.email
    }
  });

  revalidatePath("/admin/operations");
  revalidatePath(`/admin/operations/${organizationId}`);
  revalidatePath("/admin/users");
  revalidatePath("/login");
  redirect(
    `/admin/operations/${organizationId}?updated=${encodeURIComponent(
      `Acesso inicial liberado para ${result.adminUser.email}`
    )}`
  );
}
