import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  adminUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditLog(input: AuditInput) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        metadata: input.metadata ?? Prisma.JsonNull
      }
    });
  } catch (error) {
    console.error("[audit] Falha ao registrar log administrativo", error);
  }
}

export async function listAuditLogs(limit = 100) {
  return prisma.adminAuditLog.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: limit,
    include: {
      adminUser: {
        select: {
          name: true,
          email: true,
          role: true
        }
      }
    }
  });
}
