import { createHash, randomBytes } from "node:crypto";
import { BypassSeverity, ProtectionEventType } from "@prisma/client";
import { sendUnlockApprovalEmail } from "@/features/email/email.service";
import { prisma } from "@/lib/prisma";

const DEFAULT_UNLOCK_EXPIRY_MINUTES = 20;
const DEFAULT_UNLOCK_COOLDOWN_MINUTES = 5;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function expiresAt(minutes = DEFAULT_UNLOCK_EXPIRY_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function cooldownEndsAt(minutes = DEFAULT_UNLOCK_COOLDOWN_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function getApprovalUrl(unlockRequestId: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/unlock/${unlockRequestId}`;
}

export async function createUnlockRequest(input: {
  userId: string;
  deviceId?: string;
  requestedByEmail: string;
  partnerEmail?: string;
  actionType: "DISABLE_PROTECTION" | "REMOVE_DEVICE" | "REQUEST_UNINSTALL" | "RESET_PIN" | "LOGOUT_DEVICE";
  reason?: string;
}) {
  const user = await prisma.appUser.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      name: true,
      email: true,
      accountabilityEmail: true
    }
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  if (!user.accountabilityEmail) {
    throw new Error("Nenhum parceiro de responsabilidade cadastrado.");
  }

  const existingPendingRequest = await (prisma as any).unlockRequest.findFirst({
    where: {
      userId: input.userId,
      actionType: input.actionType,
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
      status: "PENDING",
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  if (existingPendingRequest) {
    return {
      unlockRequest: existingPendingRequest,
      approvalCode: null,
      reusedExisting: true
    };
  }

  const approvalCode = randomBytes(4).toString("hex").toUpperCase();
  const partnerEmail = input.partnerEmail || user.accountabilityEmail;

  const unlockRequest = await (prisma as any).unlockRequest.create({
    data: {
      userId: input.userId,
      deviceId: input.deviceId || null,
      actionType: input.actionType,
      requestedByEmail: input.requestedByEmail,
      partnerEmail,
      approvalCodeHash: hashCode(approvalCode),
      reason: input.reason || null,
      expiresAt: expiresAt()
    }
  });

  await sendUnlockApprovalEmail({
    to: partnerEmail,
    userName: user.name,
    partnerEmail,
    actionLabel: formatActionLabel(input.actionType),
    approvalCode,
    expiresAt: unlockRequest.expiresAt,
    approvalUrl: getApprovalUrl(unlockRequest.id),
    reason: input.reason || null
  });

  return {
    unlockRequest,
    approvalCode,
    reusedExisting: false
  };
}

export async function getUnlockRequestById(unlockRequestId: string) {
  const request = await (prisma as any).unlockRequest.findUnique({
    where: { id: unlockRequestId },
    include: {
      user: {
        select: { name: true, email: true }
      },
      device: {
        select: { nickname: true, platform: true }
      }
    }
  });

  if (!request) {
    return null;
  }

  if (request.status === "PENDING" && request.expiresAt <= new Date()) {
    await (prisma as any).unlockRequest.update({
      where: { id: request.id },
      data: { status: "EXPIRED" }
    });

    return {
      ...request,
      status: "EXPIRED"
    };
  }

  return request;
}

function formatActionLabel(actionType: string) {
  switch (actionType) {
    case "DISABLE_PROTECTION":
      return "desativar a proteção";
    case "REMOVE_DEVICE":
      return "remover o dispositivo";
    case "REQUEST_UNINSTALL":
      return "solicitar desinstalação";
    case "RESET_PIN":
      return "resetar o PIN";
    case "LOGOUT_DEVICE":
      return "sair do dispositivo";
    default:
      return "executar ação crítica";
  }
}

export async function verifyUnlockApproval(input: {
  unlockRequestId: string;
  approvalCode: string;
}) {
  const request = await (prisma as any).unlockRequest.findUnique({
    where: { id: input.unlockRequestId }
  });

  if (!request) {
    throw new Error("Solicitacao nao encontrada.");
  }

  if (request.status !== "PENDING") {
    throw new Error("Solicitacao nao esta pendente.");
  }

  if (request.expiresAt <= new Date()) {
    await (prisma as any).unlockRequest.update({
      where: { id: request.id },
      data: { status: "EXPIRED" }
    });
    throw new Error("Solicitacao expirada.");
  }

  if (request.approvalCodeHash !== hashCode(input.approvalCode.trim().toUpperCase())) {
    throw new Error("Codigo invalido.");
  }

  return (prisma as any).unlockRequest.update({
    where: { id: request.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      cooldownEndsAt: cooldownEndsAt()
    }
  });
}

export async function listPendingUnlockRequests() {
  return (prisma as any).unlockRequest.findMany({
    where: {
      status: "PENDING"
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      user: {
        select: { name: true, email: true }
      },
      device: {
        select: { nickname: true, platform: true }
      }
    }
  });
}

export async function listUnlockRequests(input?: {
  status?: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED" | "CANCELED";
  limit?: number;
}) {
  return (prisma as any).unlockRequest.findMany({
    where: {
      ...(input?.status ? { status: input.status } : {})
    },
    orderBy: [{ createdAt: "desc" }],
    take: input?.limit ?? 100,
    include: {
      user: {
        select: { name: true, email: true, accountabilityEmail: true }
      },
      device: {
        select: { nickname: true, platform: true, status: true }
      }
    }
  });
}

export async function getLatestUnlockRequestForUser(input: {
  userId: string;
  actionType?: string;
  deviceId?: string;
}) {
  return (prisma as any).unlockRequest.findFirst({
    where: {
      userId: input.userId,
      ...(input.actionType ? { actionType: input.actionType } : {}),
      ...(input.deviceId ? { deviceId: input.deviceId } : {})
    },
    orderBy: [{ createdAt: "desc" }]
  });
}

export async function getUnlockAvailability(input: {
  userId: string;
  actionType: string;
  deviceId?: string;
}) {
  const request = await getLatestUnlockRequestForUser(input);

  if (!request) {
    return {
      canProceed: false,
      request: null
    };
  }

  if (request.status === "APPROVED" && (!request.expiresAt || request.expiresAt > new Date())) {
    const stillCoolingDown = request.cooldownEndsAt && request.cooldownEndsAt > new Date();
    return {
      canProceed: !stillCoolingDown,
      coolingDown: stillCoolingDown,
      request
    };
  }

  if (request.status === "PENDING" && request.expiresAt <= new Date()) {
    await (prisma as any).unlockRequest.update({
      where: { id: request.id },
      data: { status: "EXPIRED" }
    });

    return {
      canProceed: false,
      request: {
        ...request,
        status: "EXPIRED"
      }
    };
  }

  return {
    canProceed: false,
    coolingDown: false,
    request
  };
}

export async function completeUnlockRequest(input: {
  unlockRequestId: string;
  userId: string;
}) {
  const request = await (prisma as any).unlockRequest.findFirst({
    where: {
      id: input.unlockRequestId,
      userId: input.userId
    }
  });

  if (!request) {
    throw new Error("Solicitação não encontrada.");
  }

  if (request.status !== "APPROVED") {
    throw new Error("Solicitação ainda não está aprovada.");
  }

  return (prisma as any).unlockRequest.update({
    where: { id: request.id },
    data: {
      status: "CANCELED",
      completedAt: new Date()
    }
  });
}

export async function resolveUnlockRequestByAdmin(input: {
  unlockRequestId: string;
  resolution: "DENIED" | "CANCELED";
  note?: string;
  adminUserId?: string | null;
}) {
  const request = await (prisma as any).unlockRequest.findUnique({
    where: { id: input.unlockRequestId },
    include: {
      user: {
        select: { name: true, email: true }
      },
      device: {
        select: { nickname: true, platform: true }
      }
    }
  });

  if (!request) {
    throw new Error("Solicitação não encontrada.");
  }

  if (!["PENDING", "APPROVED"].includes(request.status)) {
    throw new Error("Solicitação já está encerrada.");
  }

  const now = new Date();
  const metadata = {
    ...(request.metadata && typeof request.metadata === "object" ? request.metadata : {}),
    adminResolutionNote: input.note || null,
    resolvedByAdminUserId: input.adminUserId || null,
    resolvedAt: now.toISOString()
  };

  return prisma.$transaction(async (tx) => {
    const updatedRequest = await (tx as any).unlockRequest.update({
      where: { id: request.id },
      data: {
        status: input.resolution,
        deniedAt: input.resolution === "DENIED" ? now : request.deniedAt,
        completedAt: now,
        metadata
      }
    });

    await tx.protectionEvent.create({
      data: {
        userId: request.userId,
        deviceId: request.deviceId || null,
        type: ProtectionEventType.APP_STOPPED,
        severity: BypassSeverity.LOW,
        metadata: {
          actionType: request.actionType,
          resolution: input.resolution,
          note: input.note || null,
          source: "admin_unlock_resolution"
        }
      }
    });

    return updatedRequest;
  });
}

export async function resolveUnlockRequestByPartner(input: {
  unlockRequestId: string;
  note?: string;
}) {
  const request = await (prisma as any).unlockRequest.findUnique({
    where: { id: input.unlockRequestId }
  });

  if (!request) {
    throw new Error("Solicitação não encontrada.");
  }

  if (request.status !== "PENDING") {
    throw new Error("Solicitação já não está pendente.");
  }

  const now = new Date();

  return (prisma as any).unlockRequest.update({
    where: { id: request.id },
    data: {
      status: "DENIED",
      deniedAt: now,
      completedAt: now,
      metadata: {
        ...(request.metadata && typeof request.metadata === "object" ? request.metadata : {}),
        partnerDenied: true,
        partnerNote: input.note || null
      }
    }
  });
}

export async function recordProtectedActionAttempt(input: {
  userId: string;
  deviceId?: string;
  actionType: string;
  reason?: string;
}) {
  const eventType =
    input.actionType === "REQUEST_UNINSTALL"
      ? ProtectionEventType.UNINSTALL_ATTEMPT
      : input.actionType === "DISABLE_PROTECTION"
        ? ProtectionEventType.VPN_DISABLED
        : ProtectionEventType.APP_STOPPED;
  const severity =
    input.actionType === "REQUEST_UNINSTALL" ? BypassSeverity.HIGH : BypassSeverity.MEDIUM;

  await prisma.$transaction([
    prisma.protectionEvent.create({
      data: {
        userId: input.userId,
        deviceId: input.deviceId || null,
        type: eventType,
        severity,
        metadata: {
          actionType: input.actionType,
          reason: input.reason || null,
          source: "protected_action_attempt"
        }
      }
    }),
    prisma.bypassIncident.create({
      data: {
        userId: input.userId,
        deviceId: input.deviceId || null,
        severity,
        title:
          input.actionType === "REQUEST_UNINSTALL"
            ? "Tentativa de desinstalação sem aprovação"
            : "Tentativa de ação crítica sem aprovação",
        description:
          input.actionType === "REQUEST_UNINSTALL"
            ? "O app registrou tentativa de desinstalação sem desbloqueio supervisionado válido."
            : `O app registrou tentativa de ${formatActionLabel(input.actionType)} sem desbloqueio supervisionado válido.`,
        metadata: {
          actionType: input.actionType,
          reason: input.reason || null
        }
      }
    })
  ]);

  return { ok: true };
}
