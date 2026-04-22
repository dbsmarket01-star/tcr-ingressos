"use server";

import { AdminRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/features/audit/audit.service";
import { requirePermission } from "@/features/auth/auth.service";
import {
  createAdminUser,
  getAdminUserByIdInOrganization,
  updateAdminUserEventAccess,
  updateAdminUserRole,
  updateAdminUserStatus
} from "./admin-user.service";

function parseRole(value: FormDataEntryValue | null) {
  const role = String(value ?? "");

  if (!Object.values(AdminRole).includes(role as AdminRole)) {
    throw new Error("Papel inválido.");
  }

  return role as AdminRole;
}

function parseEventAccess(formData: FormData, role: AdminRole) {
  const accessAllEvents = role === AdminRole.OWNER ? true : formData.get("accessAllEvents") === "on";
  const allowedEventIds = formData
    .getAll("allowedEventIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!accessAllEvents && allowedEventIds.length === 0) {
    throw new Error("Selecione pelo menos um evento ou libere acesso total.");
  }

  return {
    accessAllEvents,
    allowedEventIds
  };
}

export async function createAdminUserAction(formData: FormData) {
  const currentAdmin = await requirePermission("USERS");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(formData.get("role"));
  const eventAccess = parseEventAccess(formData, role);

  if (name.length < 2 || !email.includes("@") || password.length < 8) {
    throw new Error("Preencha nome, email e senha com pelo menos 8 caracteres.");
  }

  const createdUser = await createAdminUser({
    organizationId: currentAdmin.organizationId!,
    name,
    email,
    password,
    role,
    ...eventAccess
  });

  await createAuditLog({
    adminUserId: currentAdmin.id,
    action: "ADMIN_USER_CREATED",
    entityType: "AdminUser",
    entityId: createdUser.id,
    metadata: {
      email: createdUser.email,
      role: createdUser.role,
      accessAllEvents: createdUser.accessAllEvents,
      allowedEventIds: createdUser.allowedEventIds
    }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
}

export async function updateAdminUserStatusAction(formData: FormData) {
  const currentAdmin = await requirePermission("USERS");
  const userId = String(formData.get("userId") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!userId) {
    throw new Error("Usuário não informado.");
  }

  const targetUser = await getAdminUserByIdInOrganization(userId, currentAdmin.organizationId!);

  if (!targetUser) {
    throw new Error("Usuário não encontrado nesta operação.");
  }

  if (currentAdmin.id === userId && !isActive) {
    throw new Error("Você não pode desativar seu próprio usuário.");
  }

  const updatedUser = await updateAdminUserStatus(userId, isActive);

  await createAuditLog({
    adminUserId: currentAdmin.id,
    action: isActive ? "ADMIN_USER_ACTIVATED" : "ADMIN_USER_DEACTIVATED",
    entityType: "AdminUser",
    entityId: updatedUser.id,
    metadata: {
      email: updatedUser.email
    }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
}

export async function updateAdminUserRoleAction(formData: FormData) {
  const currentAdmin = await requirePermission("USERS");
  const userId = String(formData.get("userId") ?? "").trim();
  const role = parseRole(formData.get("role"));

  if (!userId) {
    throw new Error("Usuário não informado.");
  }

  const targetUser = await getAdminUserByIdInOrganization(userId, currentAdmin.organizationId!);

  if (!targetUser) {
    throw new Error("Usuário não encontrado nesta operação.");
  }

  if (currentAdmin.id === userId && role !== AdminRole.OWNER) {
    throw new Error("Você não pode remover seu próprio papel de proprietário.");
  }

  const updatedUser = await updateAdminUserRole(userId, role);

  await createAuditLog({
    adminUserId: currentAdmin.id,
    action: "ADMIN_USER_ROLE_UPDATED",
    entityType: "AdminUser",
    entityId: updatedUser.id,
    metadata: {
      email: updatedUser.email,
      role: updatedUser.role
    }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
}

export async function updateAdminUserEventAccessAction(formData: FormData) {
  const currentAdmin = await requirePermission("USERS");
  const userId = String(formData.get("userId") ?? "").trim();
  const role = parseRole(formData.get("role"));
  const { accessAllEvents, allowedEventIds } = parseEventAccess(formData, role);

  if (!userId) {
    throw new Error("Usuário não informado.");
  }

  const targetUser = await getAdminUserByIdInOrganization(userId, currentAdmin.organizationId!);

  if (!targetUser) {
    throw new Error("Usuário não encontrado nesta operação.");
  }

  if (currentAdmin.id === userId && !accessAllEvents && allowedEventIds.length === 0) {
    throw new Error("Você não pode remover o acesso do seu próprio usuário sem definir eventos.");
  }

  const updatedUser = await updateAdminUserEventAccess(userId, accessAllEvents, allowedEventIds);

  await createAuditLog({
    adminUserId: currentAdmin.id,
    action: "ADMIN_USER_EVENT_ACCESS_UPDATED",
    entityType: "AdminUser",
    entityId: updatedUser.id,
    metadata: {
      email: updatedUser.email,
      accessAllEvents: updatedUser.accessAllEvents,
      allowedEventIds: updatedUser.allowedEventIds
    }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
}
