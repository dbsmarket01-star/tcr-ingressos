import { AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function listAdminUsers() {
  return prisma.adminUser.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.adminUser.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
      isActive: true
    }
  });
}

export async function updateAdminUserStatus(userId: string, isActive: boolean) {
  return prisma.adminUser.update({
    where: {
      id: userId
    },
    data: {
      isActive
    }
  });
}

export async function updateAdminUserRole(userId: string, role: AdminRole) {
  return prisma.adminUser.update({
    where: {
      id: userId
    },
    data: {
      role
    }
  });
}
