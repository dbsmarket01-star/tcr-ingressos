import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { createAdminPasswordResetUrl, sendAdminPasswordResetEmail } from "@/features/email/email.service";
import { prisma } from "@/lib/prisma";

const RESET_TOKEN_EXPIRES_MINUTES = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function changeAdminPassword(adminId: string, currentPassword: string, newPassword: string) {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { id: true, passwordHash: true }
  });

  if (!admin) {
    throw new Error("Usuario nao encontrado.");
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.passwordHash);

  if (!isCurrentPasswordValid) {
    throw new Error("Senha atual invalida.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash }
  });
}

export async function requestAdminPasswordReset(email: string) {
  const admin = await prisma.adminUser.findFirst({
    where: {
      email: email.toLowerCase(),
      isActive: true
    },
    select: {
      id: true,
      organization: {
        select: {
          name: true,
          adminDomain: true
        }
      },
      name: true,
      email: true
    }
  });

  if (!admin) {
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000);

  await prisma.adminPasswordResetToken.create({
    data: {
      adminUserId: admin.id,
      tokenHash,
      expiresAt
    }
  });

  await sendAdminPasswordResetEmail({
    to: admin.email,
    name: admin.name,
    brandName: admin.organization?.name || "TCR Ingressos",
    resetUrl: createAdminPasswordResetUrl(token, {
      adminDomain: admin.organization?.adminDomain
    }),
    expiresInMinutes: RESET_TOKEN_EXPIRES_MINUTES
  });
}

export async function resetAdminPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);

  const resetToken = await prisma.adminPasswordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date()
      },
      adminUser: {
        isActive: true
      }
    },
    select: {
      id: true,
      adminUserId: true
    }
  });

  if (!resetToken) {
    throw new Error("Link de redefinicao invalido ou expirado.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: resetToken.adminUserId },
      data: { passwordHash }
    }),
    prisma.adminPasswordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    }),
    prisma.adminPasswordResetToken.updateMany({
      where: {
        adminUserId: resetToken.adminUserId,
        usedAt: null,
        id: {
          not: resetToken.id
        }
      },
      data: {
        usedAt: new Date()
      }
    })
  ]);
}
