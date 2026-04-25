import { BypassSeverity, MobilePlatform, ProtectionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function minutesSince(value?: Date | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((Date.now() - new Date(value).getTime()) / 60000);
}

function calculateRiskLevel(input: {
  protectionStatus: ProtectionStatus;
  lastHeartbeatAt?: Date | null;
  externalVpnDetected: boolean;
  developerModeDetected: boolean;
  unresolvedHighIncidents: number;
  staleThresholdMinutes: number;
}) {
  const heartbeatAge = minutesSince(input.lastHeartbeatAt);

  if (
    input.externalVpnDetected ||
    input.unresolvedHighIncidents > 0 ||
    heartbeatAge > input.staleThresholdMinutes * 3
  ) {
    return "CRITICAL";
  }

  if (
    input.developerModeDetected ||
    input.protectionStatus === ProtectionStatus.OFFLINE ||
    heartbeatAge > input.staleThresholdMinutes
  ) {
    return "HIGH";
  }

  if (input.protectionStatus === ProtectionStatus.DEGRADED || heartbeatAge > Math.max(15, Math.floor(input.staleThresholdMinutes / 2))) {
    return "MEDIUM";
  }

  return "LOW";
}

export async function refreshDeviceRiskLevels() {
  const policy = await (prisma as any).protectionPolicy.findUnique({
    where: { slug: "default" }
  });
  const staleThresholdMinutes = policy?.staleHeartbeatGraceMinutes ?? 45;

  const devices = await prisma.protectedDevice.findMany({
    include: {
      user: {
        select: {
          id: true
        }
      },
      bypassIncidents: {
        where: {
          resolvedAt: null,
          severity: {
            in: [BypassSeverity.HIGH, BypassSeverity.CRITICAL]
          }
        },
        select: {
          id: true
        }
      }
    }
  });

  for (const device of devices) {
    const heartbeatAge = minutesSince(device.lastHeartbeatAt);
    const riskLevel = calculateRiskLevel({
      protectionStatus: device.protectionStatus,
      lastHeartbeatAt: device.lastHeartbeatAt,
      externalVpnDetected: device.externalVpnDetected,
      developerModeDetected: device.developerModeDetected,
      unresolvedHighIncidents: device.bypassIncidents.length,
      staleThresholdMinutes
    });

    if (heartbeatAge > staleThresholdMinutes && device.userId) {
      const existingStaleIncident = await prisma.bypassIncident.findFirst({
        where: {
          userId: device.userId,
          deviceId: device.id,
          resolvedAt: null,
          title: "Proteção sem heartbeat"
        }
      });

      if (!existingStaleIncident) {
        await prisma.bypassIncident.create({
          data: {
            userId: device.userId,
            deviceId: device.id,
            severity: heartbeatAge > staleThresholdMinutes * 3 ? BypassSeverity.CRITICAL : BypassSeverity.HIGH,
            title: "Proteção sem heartbeat",
            description: `O dispositivo ficou ${heartbeatAge} minuto(s) sem reportar heartbeat dentro da janela esperada.`
          }
        });
      }
    }

    if (
      (device.platform === MobilePlatform.IOS || device.platform === MobilePlatform.MACOS) &&
      device.protectionStatus !== ProtectionStatus.ONLINE &&
      device.userId
    ) {
      const applePlatformLabel = device.platform === MobilePlatform.MACOS ? "macOS" : "iOS";
      const appleDeviceLabel = device.platform === MobilePlatform.MACOS ? "Mac" : "iPhone";
      const existingIosIncident = await prisma.bypassIncident.findFirst({
        where: {
          userId: device.userId,
          deviceId: device.id,
          resolvedAt: null,
          title: `Proteção ${applePlatformLabel} degradada`
        }
      });

      if (!existingIosIncident) {
        await prisma.bypassIncident.create({
          data: {
            userId: device.userId,
            deviceId: device.id,
            severity:
              device.protectionStatus === ProtectionStatus.OFFLINE
                ? BypassSeverity.HIGH
                : BypassSeverity.MEDIUM,
            title: `Proteção ${applePlatformLabel} degradada`,
            description:
              `O ${appleDeviceLabel} reportou proteção degradada ou offline. A extensão Network Extension deve ser revisada no aparelho.`
          }
        });
      }
    }

    await prisma.protectedDevice.update({
      where: { id: device.id },
      data: {
        riskLevel: riskLevel as any,
        riskUpdatedAt: new Date()
      }
    });
  }

  return devices.length;
}

export async function getDeviceRiskOverview() {
  await refreshDeviceRiskLevels();

  const [devices, pendingUnlockRequests] = await Promise.all([
    prisma.protectedDevice.findMany({
      orderBy: [{ riskLevel: "desc" }, { lastHeartbeatAt: "asc" }],
      take: 50,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    }),
    (prisma as any).unlockRequest.findMany({
      where: {
        status: "PENDING"
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        device: {
          select: {
            nickname: true,
            platform: true
          }
        }
      }
    })
  ]);

  return {
    devices,
    pendingUnlockRequests
  };
}

export async function getDeviceDiagnostics(deviceId: string) {
  await refreshDeviceRiskLevels();

  const device = await prisma.protectedDevice.findUnique({
    where: { id: deviceId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          accountabilityEmail: true
        }
      },
      protectionEvents: {
        orderBy: { createdAt: "desc" },
        take: 30
      },
      bypassIncidents: {
        orderBy: { createdAt: "desc" },
        take: 20
      },
      unlockRequests: {
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });

  if (!device) {
    return null;
  }

  const heartbeatAgeMinutes = minutesSince(device.lastHeartbeatAt);
  const recentBlockedEvents = device.protectionEvents.filter(
    (event) => event.type === "BLOCKED_DOMAIN" || event.type === "BLOCKED_URL"
  ).length;
  const unresolvedIncidents = device.bypassIncidents.filter((incident) => !incident.resolvedAt).length;
  const latestHeartbeat = device.protectionEvents.find((event) => event.type === "HEARTBEAT") || null;
  const latestHeartbeatMetadata =
    latestHeartbeat?.metadata && typeof latestHeartbeat.metadata === "object"
      ? (latestHeartbeat.metadata as Record<string, unknown>)
      : null;
  const timeline = [
    ...device.protectionEvents.map((event) => ({
      id: event.id,
      createdAt: event.createdAt,
      kind: "EVENT",
      label: event.type,
      severity: event.severity,
      detail: event.blockedValue || event.matchedRule || null
    })),
    ...device.bypassIncidents.map((incident) => ({
      id: incident.id,
      createdAt: incident.createdAt,
      kind: "INCIDENT",
      label: incident.title,
      severity: incident.severity,
      detail: incident.description
    })),
    ...device.unlockRequests.map((request) => ({
      id: request.id,
      createdAt: request.createdAt,
      kind: "UNLOCK",
      label: request.actionType,
      severity: request.status,
      detail: request.reason || request.partnerEmail
    }))
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);

  return {
    device,
    diagnostics: {
      heartbeatAgeMinutes: Number.isFinite(heartbeatAgeMinutes) ? heartbeatAgeMinutes : null,
      recentBlockedEvents,
      unresolvedIncidents,
      pendingUnlocks: device.unlockRequests.filter((request) => request.status === "PENDING").length,
      latestHeartbeatMetadata: latestHeartbeatMetadata
        ? {
            platform: latestHeartbeatMetadata.platform ?? null,
            protectionMode: latestHeartbeatMetadata.protectionMode ?? null,
            appGroupConfigured: latestHeartbeatMetadata.appGroupConfigured === true,
            extensionTargetReady: latestHeartbeatMetadata.extensionTargetReady === true,
            extensionRunning: latestHeartbeatMetadata.extensionRunning === true,
            extensionBundleEmbedded: latestHeartbeatMetadata.extensionBundleEmbedded === true,
            extensionLastUpdatedAt:
              typeof latestHeartbeatMetadata.extensionLastUpdatedAt === "number"
                ? latestHeartbeatMetadata.extensionLastUpdatedAt
                : null,
            extensionStopReason:
              typeof latestHeartbeatMetadata.extensionStopReason === "string"
                ? latestHeartbeatMetadata.extensionStopReason
                : null,
            extensionOperationalState:
              typeof latestHeartbeatMetadata.extensionOperationalState === "string"
                ? latestHeartbeatMetadata.extensionOperationalState
                : null,
            extensionControlMode:
              typeof latestHeartbeatMetadata.extensionControlMode === "string"
                ? latestHeartbeatMetadata.extensionControlMode
                : null,
            localDomainEvaluationReady: latestHeartbeatMetadata.localDomainEvaluationReady === true
          }
        : null
    },
    timeline
  };
}
