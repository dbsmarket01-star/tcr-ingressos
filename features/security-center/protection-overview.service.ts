import { prisma } from "@/lib/prisma";

export async function getProtectionOverview() {
  const latestAppleHeartbeatsPromise = prisma.protectionEvent.findMany({
    where: {
      type: "HEARTBEAT",
      device: {
        platform: {
          in: ["IOS", "MACOS"]
        }
      }
    },
    orderBy: [{ deviceId: "asc" }, { createdAt: "desc" }],
    distinct: ["deviceId"],
    select: {
      deviceId: true,
      metadata: true
    }
  });

  const [
    plans,
    topEvents,
    recentIncidents,
    latestUnlockRequests,
    riskBuckets,
    protectionBuckets,
    criticalSignals,
    totalDevices,
    pendingUnlockCount,
    platformBuckets,
    iosDeviceCount,
    iosOnlineCount,
    iosDegradedIncidentCount,
    iosPendingUnlockCount,
    macosDeviceCount,
    macosOnlineCount,
    macosDegradedIncidentCount,
    macosPendingUnlockCount,
    latestAppleHeartbeats,
    iosAppGroupIncidentCount,
    iosExtensionNotReadyIncidentCount,
    iosExtensionInactiveIncidentCount,
    macosAppGroupIncidentCount,
    macosExtensionNotReadyIncidentCount,
    macosExtensionInactiveIncidentCount
  ] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { priceInCents: "asc" }]
    }),
    prisma.protectionEvent.groupBy({
      by: ["type"],
      _count: { _all: true },
      orderBy: {
        _count: {
          type: "desc"
        }
      },
      take: 8
    }),
    prisma.bypassIncident.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: {
          select: { name: true, email: true }
        },
        device: {
          select: { nickname: true, platform: true }
        }
      }
    }),
    (prisma as any).unlockRequest.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 10,
      include: {
        user: {
          select: { name: true, email: true }
        },
        device: {
          select: { nickname: true, platform: true }
        }
      }
    }),
    prisma.protectedDevice.groupBy({
      by: ["riskLevel"],
      _count: { _all: true }
    }),
    prisma.protectedDevice.groupBy({
      by: ["protectionStatus"],
      _count: { _all: true }
    }),
    prisma.bypassIncident.groupBy({
      by: ["title", "severity"],
      _count: { _all: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
        }
      },
      orderBy: {
        _count: {
          title: "desc"
        }
      },
      take: 8
    }),
    prisma.protectedDevice.count(),
    (prisma as any).unlockRequest.count({
      where: {
        status: "PENDING"
      }
    }),
    prisma.protectedDevice.groupBy({
      by: ["platform"],
      _count: { _all: true }
    }),
    prisma.protectedDevice.count({
      where: {
        platform: "IOS"
      }
    }),
    prisma.protectedDevice.count({
      where: {
        platform: "IOS",
        protectionStatus: "ONLINE"
      }
    }),
    prisma.bypassIncident.count({
      where: {
        title: "Proteção iOS degradada",
        resolvedAt: null
      }
    }),
    (prisma as any).unlockRequest.count({
      where: {
        status: "PENDING",
        device: {
          platform: "IOS"
        }
      }
    }),
    prisma.protectedDevice.count({
      where: {
        platform: "MACOS"
      }
    }),
    prisma.protectedDevice.count({
      where: {
        platform: "MACOS",
        protectionStatus: "ONLINE"
      }
    }),
    prisma.bypassIncident.count({
      where: {
        title: "Proteção macOS degradada",
        resolvedAt: null
      }
    }),
    (prisma as any).unlockRequest.count({
      where: {
        status: "PENDING",
        device: {
          platform: "MACOS"
        }
      }
    }),
    latestAppleHeartbeatsPromise,
    prisma.bypassIncident.count({
      where: {
        title: "App Group iOS não configurado",
        resolvedAt: null
      }
    }),
    prisma.bypassIncident.count({
      where: {
        title: "Extensão iOS não preparada",
        resolvedAt: null
      }
    }),
    prisma.bypassIncident.count({
      where: {
        title: "Extensão iOS sem execução",
        resolvedAt: null
      }
    }),
    prisma.bypassIncident.count({
      where: {
        title: "App Group macOS não configurado",
        resolvedAt: null
      }
    }),
    prisma.bypassIncident.count({
      where: {
        title: "Extensão macOS não preparada",
        resolvedAt: null
      }
    }),
    prisma.bypassIncident.count({
      where: {
        title: "Extensão macOS sem execução",
        resolvedAt: null
      }
    })
  ]);

  const iosHeartbeats = latestAppleHeartbeats.filter((event) => {
    const metadata =
      event.metadata && typeof event.metadata === "object"
        ? (event.metadata as Record<string, unknown>)
        : null;
    return metadata?.platform === "IOS";
  });

  const macosHeartbeats = latestAppleHeartbeats.filter((event) => {
    const metadata =
      event.metadata && typeof event.metadata === "object"
        ? (event.metadata as Record<string, unknown>)
        : null;
    return metadata?.platform === "MACOS";
  });

  const appleAppGroupReadyCount = latestAppleHeartbeats.filter((event) => {
    const metadata =
      event.metadata && typeof event.metadata === "object"
        ? (event.metadata as Record<string, unknown>)
        : null;
    return metadata?.appGroupConfigured === true;
  }).length;

  const appleExtensionReadyCount = latestAppleHeartbeats.filter((event) => {
    const metadata =
      event.metadata && typeof event.metadata === "object"
        ? (event.metadata as Record<string, unknown>)
        : null;
    return metadata?.extensionTargetReady === true;
  }).length;

  const appleExtensionRunningCount = latestAppleHeartbeats.filter((event) => {
    const metadata =
      event.metadata && typeof event.metadata === "object"
        ? (event.metadata as Record<string, unknown>)
        : null;
    return metadata?.extensionRunning === true;
  }).length;

  const countAppleMetric = (
    events: Array<{ metadata: unknown }>,
    field: "appGroupConfigured" | "extensionTargetReady" | "extensionRunning"
  ) =>
    events.filter((event) => {
      const metadata =
        event.metadata && typeof event.metadata === "object"
          ? (event.metadata as Record<string, unknown>)
          : null;
      return metadata?.[field] === true;
    }).length;

  return {
    plans,
    topEvents,
    recentIncidents,
    latestUnlockRequests,
    riskBuckets,
    protectionBuckets,
    criticalSignals,
    totalDevices,
    pendingUnlockCount,
    platformBuckets,
    iosDeviceCount,
    iosOnlineCount,
    iosDegradedIncidentCount,
    iosPendingUnlockCount,
    macosDeviceCount,
    macosOnlineCount,
    macosDegradedIncidentCount,
    macosPendingUnlockCount,
    appleDeviceCount: iosDeviceCount + macosDeviceCount,
    appleOnlineCount: iosOnlineCount + macosOnlineCount,
    appleAppGroupReadyCount,
    appleExtensionReadyCount,
    appleExtensionRunningCount,
    iosAppGroupReadyCount: countAppleMetric(iosHeartbeats, "appGroupConfigured"),
    iosExtensionReadyCount: countAppleMetric(iosHeartbeats, "extensionTargetReady"),
    iosExtensionRunningCount: countAppleMetric(iosHeartbeats, "extensionRunning"),
    macosAppGroupReadyCount: countAppleMetric(macosHeartbeats, "appGroupConfigured"),
    macosExtensionReadyCount: countAppleMetric(macosHeartbeats, "extensionTargetReady"),
    macosExtensionRunningCount: countAppleMetric(macosHeartbeats, "extensionRunning"),
    iosAppGroupIncidentCount,
    iosExtensionNotReadyIncidentCount,
    iosExtensionInactiveIncidentCount,
    macosAppGroupIncidentCount,
    macosExtensionNotReadyIncidentCount,
    macosExtensionInactiveIncidentCount
  };
}
