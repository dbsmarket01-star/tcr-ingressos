"use server";

import { AdminRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/features/audit/audit.service";
import { requirePermission } from "@/features/auth/auth.service";
import { createAdminUser, updateAdminUserRole, updateAdminUserStatus } from "./admin-user.service";

function parseRole(value: FormDataEntryValue | null) {
  const role = String(value ?? "");

  if (!Object.values(AdminRole).includes(role as AdminRole)) {
    throw new Error("Papel invalido.");
  }

  return role as AdminRole;
}

export async function createAdminUserAction(formData: FormData) {
  const currentAdmin = await requirePermission("USERS");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(formData.get("role"));

  if (name.length < 2 || !email.includes("@") || password.length < 8) {
    throw new Error("Preencha nome, email e senha com pelo menos 8 caracteres.");
  }

  const createdUser = await createAdminUser({
    name,
    email,
    password,
    role
  });

  await createAuditLog({
    adminUserId: currentAdmin.id,
    action: "ADMIN_USER_CREATED",
    entityType: "AdminUser",
    entityId: createdUser.id,
    metadata: {
      email: createdUser.email,
      role: createdUser.role
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
    throw new Error("Usuario nao informado.");
  }

  if (currentAdmin.id === userId && !isActive) {
    throw new Error("Voce nao pode desativar seu proprio usuario.");
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
    throw new Error("Usuario nao informado.");
  }

  if (currentAdmin.id === userId && role !== AdminRole.OWNER) {
    throw new Error("Voce nao pode remover seu proprio papel de proprietario.");
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
