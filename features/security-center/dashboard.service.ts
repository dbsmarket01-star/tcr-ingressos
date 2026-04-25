import { AppUserStatus, BypassSeverity, DeviceStatus, ProtectionStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshDeviceRiskLevels } from "./device-risk.service";

function countByField<T extends string, K extends string>(
  items: Array<Record<K, T> & { _count: { _all: number } }>,
  key: K
) {
  return Object.fromEntries(items.map((item) => [item[key], item._count._all])) as Partial<Record<T, number>>;
}

export async function getSecurityDashboard() {
  await refreshDeviceRiskLevels();

  const [usersByStatus, devicesByStatus, devicesByProtection, devicesByRisk, subscriptionsByStatus, incidentsBySeverity, recentIncidents, recentDevices, plans, pendingUnlockRequests] =
    await Promise.all([
      prisma.appUser.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      prisma.protectedDevice.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      prisma.protectedDevice.groupBy({
        by: ["protectionStatus"],
        _count: { _all: true }
      }),
      (prisma as any).protectedDevice.groupBy({
        by: ["riskLevel"],
        _count: { _all: true }
      }),
      prisma.subscription.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      prisma.bypassIncident.groupBy({
        by: ["severity"],
        _count: { _all: true }
      }),
      prisma.bypassIncident.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          device: {
            select: { id: true, nickname: true, platform: true }
          }
        }
      }),
      prisma.protectedDevice.findMany({
        orderBy: [{ updatedAt: "desc" }],
        take: 8,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.subscriptionPlan.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { priceInCents: "asc" }],
        include: {
          _count: {
            select: {
              subscriptions: true
            }
          }
        }
      }),
      (prisma as any).unlockRequest.count({
        where: {
          status: "PENDING"
        }
      })
    ]);

  const userCounts = countByField<AppUserStatus, "status">(usersByStatus, "status");
  const deviceCounts = countByField<DeviceStatus, "status">(devicesByStatus, "status");
  const protectionCounts = countByField<ProtectionStatus, "protectionStatus">(devicesByProtection, "protectionStatus");
  const riskCounts = countByField<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", "riskLevel">(devicesByRisk, "riskLevel");
  const subscriptionCounts = countByField<SubscriptionStatus, "status">(subscriptionsByStatus, "status");
  const incidentCounts = countByField<BypassSeverity, "severity">(incidentsBySeverity, "severity");

  return {
    totals: {
      users:
        (userCounts.TRIAL ?? 0) +
        (userCounts.ACTIVE ?? 0) +
        (userCounts.GRACE ?? 0) +
        (userCounts.PAST_DUE ?? 0) +
        (userCounts.CANCELED ?? 0) +
        (userCounts.BLOCKED ?? 0),
      activeUsers: (userCounts.ACTIVE ?? 0) + (userCounts.GRACE ?? 0),
      protectedDevices: deviceCounts.ACTIVE ?? 0,
      blockedDevices: deviceCounts.BLOCKED ?? 0,
      onlineProtection: protectionCounts.ONLINE ?? 0,
      degradedProtection: protectionCounts.DEGRADED ?? 0,
      highRiskDevices: (riskCounts.HIGH ?? 0) + (riskCounts.CRITICAL ?? 0),
      criticalRiskDevices: riskCounts.CRITICAL ?? 0,
      activeSubscriptions: subscriptionCounts.ACTIVE ?? 0,
      trialSubscriptions: subscriptionCounts.TRIALING ?? 0,
      criticalIncidents: incidentCounts.CRITICAL ?? 0,
      highIncidents: incidentCounts.HIGH ?? 0,
      pendingUnlockRequests
    },
    plans,
    recentIncidents,
    recentDevices
  };
}
