import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** A durable, unique claim prevents retries/double clicks from repeating mutations.
 * Keep the claim on uncertain failures: a new proposal must inspect fresh state.
 */
export async function claimAssistantResolution(admin: { id: string; organizationId: string }, proposalId: string, action: "ADMIN_ASSISTANT_PROCESSING" | "ADMIN_ASSISTANT_DISCARDED") {
  try {
    await prisma.adminAuditLog.create({ data: {
      id: `assistant-resolution:${proposalId}`, adminUserId: admin.id, action,
      entityType: "ADMIN_ASSISTANT", entityId: proposalId,
      metadata: { organizationId: admin.organizationId }
    } });
    return true;
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") return false;
    throw cause;
  }
}
