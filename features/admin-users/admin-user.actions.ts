"use server";

import { AdminRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  const scopeMode = String(formData.get("scopeMode") ?? "");
  const accessAllEvents =
    role === AdminRole.OWNER ? true : scopeMode ? scopeMode === "ALL" : formData.get("accessAllEvents") === "on";
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
  let eventAccess: ReturnType<typeof parseEventAccess>;

  try {
    eventAccess = parseEventAccess(formData, role);
  } catch (error) {
    redirect(
      `/admin/users?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Não foi possível validar o escopo do usuário."
      )}`
    );
  }

  if (name.length < 2 || !email.includes("@") || password.length < 8) {
    redirect(`/admin/users?error=${encodeURIComponent("Preencha nome, email e senha com pelo menos 8 caracteres.")}`);
  }

  let createdUser: Awaited<ReturnType<typeof createAdminUser>>;

  try {
    createdUser = await createAdminUser({
      organizationId: currentAdmin.organizationId!,
      name,
      email,
      password,
      role,
      ...eventAccess
    });
  } catch (error) {
    redirect(
      `/admin/users?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Não foi possível criar o usuário."
      )}`
    );
  }

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
  redirect(`/admin/users?created=${encodeURIComponent(createdUser.email)}`);
}

export async function updateAdminUserStatusAction(formData: FormData) {
  const currentAdmin = await requirePermission("USERS");
  const userId = String(formData.get("userId") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!userId) {
    redirect(`/admin/users?error=${encodeURIComponent("Usuário não informado.")}`);
  }

  const targetUser = await getAdminUserByIdInOrganization(userId, currentAdmin.organizationId!);

  if (!targetUser) {
    redirect(`/admin/users?error=${encodeURIComponent("Usuário não encontrado nesta operação.")}`);
  }

  if (currentAdmin.id === userId && !isActive) {
    redirect(`/admin/users?error=${encodeURIComponent("Você não pode desativar seu próprio usuário.")}`);
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
  redirect(
    `/admin/users?updated=${encodeURIComponent(
      `${updatedUser.email} ${isActive ? "ativado" : "desativado"}`
    )}`
  );
}

export async function updateAdminUserRoleAction(formData: FormData) {
  const currentAdmin = await requirePermission("USERS");
  const userId = String(formData.get("userId") ?? "").trim();
  const role = parseRole(formData.get("role"));

  if (!userId) {
    redirect(`/admin/users?error=${encodeURIComponent("Usuário não informado.")}`);
  }

  const targetUser = await getAdminUserByIdInOrganization(userId, currentAdmin.organizationId!);

  if (!targetUser) {
    redirect(`/admin/users?error=${encodeURIComponent("Usuário não encontrado nesta operação.")}`);
  }

  if (currentAdmin.id === userId && role !== AdminRole.OWNER) {
    redirect(`/admin/users?error=${encodeURIComponent("Você não pode remover seu próprio papel de proprietário.")}`);
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
  redirect(`/admin/users?updated=${encodeURIComponent(`Papel atualizado para ${updatedUser.email}`)}`);
}

export async function updateAdminUserEventAccessAction(formData: FormData) {
  const currentAdmin = await requirePermission("USERS");
  const userId = String(formData.get("userId") ?? "").trim();
  const role = parseRole(formData.get("role"));
  let accessAllEvents = false;
  let allowedEventIds: string[] = [];

  try {
    const parsed = parseEventAccess(formData, role);
    accessAllEvents = parsed.accessAllEvents;
    allowedEventIds = parsed.allowedEventIds;
  } catch (error) {
    redirect(
      `/admin/users?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Não foi possível validar o acesso por evento."
      )}`
    );
  }

  if (!userId) {
    redirect(`/admin/users?error=${encodeURIComponent("Usuário não informado.")}`);
  }

  const targetUser = await getAdminUserByIdInOrganization(userId, currentAdmin.organizationId!);

  if (!targetUser) {
    redirect(`/admin/users?error=${encodeURIComponent("Usuário não encontrado nesta operação.")}`);
  }

  if (currentAdmin.id === userId && !accessAllEvents && allowedEventIds.length === 0) {
    redirect(
      `/admin/users?error=${encodeURIComponent(
        "Você não pode remover o acesso do seu próprio usuário sem definir eventos."
      )}`
    );
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
  redirect(`/admin/users?updated=${encodeURIComponent(`Escopo atualizado para ${updatedUser.email}`)}`);
}
