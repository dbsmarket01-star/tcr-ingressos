import { AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function listAdminUsers(organizationId: string) {
  return prisma.adminUser.findMany({
    where: {
      organizationId
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      organizationId: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      accessAllEvents: true,
      allowedEventIds: true
    }
  });
}

export async function createAdminUser(input: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  accessAllEvents: boolean;
  allowedEventIds: string[];
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.adminUser.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
      isActive: true,
      accessAllEvents: input.role === AdminRole.OWNER ? true : input.accessAllEvents,
      allowedEventIds: input.role === AdminRole.OWNER || input.accessAllEvents ? [] : input.allowedEventIds
    },
    select: {
      id: true,
      email: true,
      role: true,
      accessAllEvents: true,
      allowedEventIds: true
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
    },
    select: {
      id: true,
      email: true
    }
  });
}

export async function updateAdminUserRole(userId: string, role: AdminRole) {
  return prisma.adminUser.update({
    where: {
      id: userId
    },
    data: {
      role,
      ...(role === AdminRole.OWNER
        ? {
            accessAllEvents: true,
            allowedEventIds: []
          }
        : {})
    },
    select: {
      id: true,
      email: true,
      role: true
    }
  });
}

export async function updateAdminUserEventAccess(
  userId: string,
  accessAllEvents: boolean,
  allowedEventIds: string[]
) {
  return prisma.adminUser.update({
    where: {
      id: userId
    },
    data: {
      accessAllEvents,
      allowedEventIds: accessAllEvents ? [] : allowedEventIds
    },
    select: {
      id: true,
      email: true,
      accessAllEvents: true,
      allowedEventIds: true
    }
  });
}

export async function getAdminUserByIdInOrganization(userId: string, organizationId: string) {
  return prisma.adminUser.findFirst({
    where: {
      id: userId,
      organizationId
    },
    select: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      accessAllEvents: true,
      allowedEventIds: true
    }
  });
}
