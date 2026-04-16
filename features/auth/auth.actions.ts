"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import {
  changePasswordSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema
} from "./auth.schema";
import { createAuditLog } from "@/features/audit/audit.service";
import { changeAdminPassword, requestAdminPasswordReset, resetAdminPassword } from "./password.service";
import { clearAdminSession, createAdminSession, findActiveAdminByEmail, requireAdmin } from "./auth.service";

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? "")
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const admin = await findActiveAdminByEmail(parsed.data.email);

  if (!admin) {
    redirect("/login?error=invalid");
  }

  const isPasswordValid = await bcrypt.compare(parsed.data.password, admin.passwordHash);

  if (!isPasswordValid) {
    redirect("/login?error=invalid");
  }

  await createAdminSession(admin);
  redirect("/admin");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? "")
  });

  if (!parsed.success) {
    redirect("/admin/account?error=invalid");
  }

  try {
    await changeAdminPassword(admin.id, parsed.data.currentPassword, parsed.data.newPassword);
  } catch {
    redirect("/admin/account?error=invalid");
  }

  await createAuditLog({
    adminUserId: admin.id,
    action: "ADMIN_PASSWORD_CHANGED",
    entityType: "AdminUser",
    entityId: admin.id
  });

  redirect("/admin/account?changed=1");
}

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = requestPasswordResetSchema.safeParse({
    email: String(formData.get("email") ?? "")
  });

  if (parsed.success) {
    await requestAdminPasswordReset(parsed.data.email);
  }

  redirect("/login/forgot?sent=1");
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? "")
  });

  if (!parsed.success) {
    redirect(`/login/reset/${String(formData.get("token") ?? "")}?error=invalid`);
  }

  try {
    await resetAdminPassword(parsed.data.token, parsed.data.newPassword);
  } catch {
    redirect(`/login/reset/${parsed.data.token}?error=invalid`);
  }

  await clearAdminSession();
  redirect("/login?reset=1");
}
