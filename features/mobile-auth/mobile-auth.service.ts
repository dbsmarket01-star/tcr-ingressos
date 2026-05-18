import bcrypt from "bcryptjs";
import {
  AppUserStatus,
  BypassSeverity,
  DeviceStatus,
  MobilePlatform,
  Prisma,
  ProtectionEventType,
  ProtectionMode,
  ProtectionStatus,
  SubscriptionStatus
} from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getPolicySyncPayload } from "@/features/security-center/protection-policy.service";

const MOBILE_SESSION_TTL_DAYS = 30;

type RegisterAppUserInput = {
  name: string;
  email: string;
  password: string;
  planCode?: string;
  accountabilityEmail?: string;
};

type LoginAppUserInput = {
  email: string;
  password: string;
  deviceLabel?: string;
};

type RegisterDeviceInput = {
  userId: string;
  deviceFingerprint: string;
  nickname?: string;
  platform: MobilePlatform;
  protectionMode: ProtectionMode;
  appVersion?: string;
  osVersion?: string;
  pushToken?: string;
};

type HeartbeatInput = {
  userId: string;
  installationKey: string;
  protectionStatus: ProtectionStatus;
  vpnEnabled: boolean;
  dnsProfileInstalled: boolean;
  externalVpnDetected: boolean;
  developerModeDetected: boolean;
  uninstallGuardEnabled: boolean;
  protectedByPin: boolean;
  platform?: MobilePlatform;
  protectionMode?: ProtectionMode;
  appGroupConfigured?: boolean;
  extensionTargetReady?: boolean;
  extensionRunning?: boolean;
  extensionBundleEmbedded?: boolean;
  extensionLastUpdatedAt?: number;
  extensionStopReason?: string;
  extensionOperationalState?: string;
  extensionControlMode?: string;
  localDomainEvaluationReady?: boolean;
  blockedValue?: string;
  matchedRule?: string;
  events?: Array<{
    type: string;
    blockedValue?: string;
    matchedRule?: string;
  }>;
};

type LocalProtectionEventsInput = {
  userId: string;
  installationKey: string;
  events: Array<{
    type: string;
    blockedValue?: string;
    matchedRule?: string;
    metadata?: Record<string, unknown>;
  }>;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MOBILE_SESSION_TTL_DAYS);
  return expiresAt;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildProtectionPolicy(plan: {
  trialDays: number;
  gracePeriodDays: number;
  maxDevices: number;
  allowsRecoveryTools: boolean;
  allowsAccountability: boolean;
}) {
  return {
    dnsFiltering: true,
    pornographyPriority: true,
    androidLocalVpnRequired: true,
    iosNetworkExtensionRequired: true,
    antiBypass: {
      pinRequiredToDisable: true,
      externalVpnDetection: true,
      heartbeatRequired: true
    },
    plan: {
      maxDevices: plan.maxDevices,
      trialDays: plan.trialDays,
      gracePeriodDays: plan.gracePeriodDays,
      allowsRecoveryTools: plan.allowsRecoveryTools,
      allowsAccountability: plan.allowsAccountability
    }
  };
}

async function createAppUserSession(
  userId: string,
  deviceLabel?: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  const rawToken = randomBytes(32).toString("base64url");

  await client.appUserSession.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      deviceLabel: deviceLabel || null,
      expiresAt: sessionExpiresAt()
    }
  });

  return rawToken;
}

export async function registerAppUser(input: RegisterAppUserInput) {
  const email = normalizeEmail(input.email);
  const existingUser = await prisma.appUser.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new Error("Já existe uma conta com esse e-mail.");
  }

  const plan =
    (input.planCode
      ? await prisma.subscriptionPlan.findUnique({
          where: { code: input.planCode }
        })
      : null) ||
    (await prisma.subscriptionPlan.findFirst({
      where: {
        code: "monthly",
        status: "ACTIVE"
      }
    })) ||
    (await prisma.subscriptionPlan.findFirst({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { priceInCents: "asc" }]
    }));

  if (!plan) {
    throw new Error("Nenhum plano ativo disponível para cadastro.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + plan.trialDays);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.appUser.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        accountabilityEmail: input.accountabilityEmail || null,
        status: AppUserStatus.TRIAL,
        trialEndsAt,
        accessEndsAt: trialEndsAt,
        recoveryStartDate: new Date()
      }
    });

    await tx.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: SubscriptionStatus.TRIALING,
        startedAt: new Date(),
        trialEndsAt,
        currentPeriodStartsAt: new Date(),
        currentPeriodEndsAt: trialEndsAt
      }
    });

    const token = await createAppUserSession(user.id, "Cadastro inicial", tx);

    return { user, token, plan };
  });

  return result;
}

export async function loginAppUser(input: LoginAppUserInput) {
  const email = normalizeEmail(input.email);
  const user = await prisma.appUser.findUnique({
    where: { email },
    include: {
      subscriptions: {
        where: {
          status: {
            in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]
          }
        },
        include: {
          plan: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      }
    }
  });

  if (!user?.passwordHash) {
    throw new Error("Conta não encontrada.");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new Error("Credenciais inválidas.");
  }

  const token = await createAppUserSession(user.id, input.deviceLabel);
  return {
    user,
    token,
    activeSubscription: user.subscriptions[0] || null
  };
}

export async function getAppUserFromBearerToken(authorizationHeader?: string | null) {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return null;
  }

  const session = await prisma.appUserSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      user: {
        include: {
          subscriptions: {
            orderBy: {
              createdAt: "desc"
            },
            include: {
              plan: true
            },
            take: 1
          }
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  await prisma.appUserSession.update({
    where: { id: session.id },
    data: {
      lastUsedAt: new Date()
    }
  });

  return {
    session,
    user: session.user,
    activeSubscription: session.user.subscriptions[0] || null
  };
}

function assertUserHasOperationalAccess(status: AppUserStatus) {
  if (
    status !== AppUserStatus.TRIAL &&
    status !== AppUserStatus.ACTIVE &&
    status !== AppUserStatus.GRACE
  ) {
    throw new Error("A assinatura não permite usar o app neste momento.");
  }
}

export async function getMobileBootstrap(userId: string) {
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        orderBy: {
          createdAt: "desc"
        },
        include: {
          plan: true
        },
        take: 1
      },
      devices: {
        where: {
          status: {
            in: [DeviceStatus.ACTIVE, DeviceStatus.PENDING]
          }
        },
        orderBy: [{ updatedAt: "desc" }]
      }
    }
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  assertUserHasOperationalAccess(user.status);

  const subscription = user.subscriptions[0];

  if (!subscription) {
    throw new Error("Nenhuma assinatura encontrada.");
  }

  const policySync = await getPolicySyncPayload(user.id);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      currentStreakDays: user.currentStreakDays,
      longestStreakDays: user.longestStreakDays,
      accountabilityEmail: user.accountabilityEmail
    },
    subscription: {
      id: subscription.id,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEndsAt: subscription.currentPeriodEndsAt,
      graceEndsAt: subscription.graceEndsAt,
      plan: subscription.plan
    },
    policy: buildProtectionPolicy(subscription.plan),
    policySync,
    devices: user.devices
  };
}

export async function getMobileDiagnostics(input: {
  userId: string;
  installationKey?: string;
}) {
  const user = await prisma.appUser.findUnique({
    where: { id: input.userId },
    include: {
      subscriptions: {
        orderBy: {
          createdAt: "desc"
        },
        include: {
          plan: true
        },
        take: 1
      },
      devices: {
        orderBy: [{ updatedAt: "desc" }]
      }
    }
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  assertUserHasOperationalAccess(user.status);

  const subscription = user.subscriptions[0];

  if (!subscription) {
    throw new Error("Nenhuma assinatura encontrada.");
  }

  const currentDevice =
    (input.installationKey
      ? user.devices.find((device) => device.installationKey === input.installationKey)
      : null) || user.devices[0] || null;

  const pendingUnlockCount = await (prisma as any).unlockRequest.count({
    where: {
      userId: input.userId,
      status: "PENDING"
    }
  });

  const unresolvedIncidentCount = await prisma.bypassIncident.count({
    where: {
      userId: input.userId,
      resolvedAt: null
    }
  });

  const latestHeartbeatEvent = currentDevice
    ? await prisma.protectionEvent.findFirst({
        where: {
          deviceId: currentDevice.id,
          type: ProtectionEventType.HEARTBEAT
        },
        orderBy: {
          createdAt: "desc"
        }
      })
    : null;
  const heartbeatMetadata =
    latestHeartbeatEvent?.metadata && typeof latestHeartbeatEvent.metadata === "object"
      ? (latestHeartbeatEvent.metadata as Record<string, unknown>)
      : null;

  return {
    serverTime: new Date().toISOString(),
    user: {
      id: user.id,
      status: user.status,
      accountabilityEmail: user.accountabilityEmail,
      currentStreakDays: user.currentStreakDays,
      longestStreakDays: user.longestStreakDays
    },
    subscription: {
      id: subscription.id,
      status: subscription.status,
      graceEndsAt: subscription.graceEndsAt,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEndsAt: subscription.currentPeriodEndsAt,
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
        maxDevices: subscription.plan.maxDevices
      }
    },
    fleet: {
      activeDevices: user.devices.filter((device) => device.status === DeviceStatus.ACTIVE).length,
      totalDevices: user.devices.length,
      pendingUnlockCount,
      unresolvedIncidentCount
    },
    currentDevice: currentDevice
      ? {
          id: currentDevice.id,
          nickname: currentDevice.nickname,
          protectionMode: currentDevice.protectionMode,
          platform: currentDevice.platform,
          status: currentDevice.status,
          protectionStatus: currentDevice.protectionStatus,
          vpnEnabled: currentDevice.vpnEnabled,
          protectedByPin: currentDevice.protectedByPin,
          uninstallGuardEnabled: currentDevice.uninstallGuardEnabled,
          externalVpnDetected: currentDevice.externalVpnDetected,
          developerModeDetected: currentDevice.developerModeDetected,
          lastHeartbeatAt: currentDevice.lastHeartbeatAt,
          updatedAt: currentDevice.updatedAt,
          appGroupConfigured: heartbeatMetadata?.appGroupConfigured === true,
          extensionTargetReady: heartbeatMetadata?.extensionTargetReady === true,
          extensionRunning: heartbeatMetadata?.extensionRunning === true,
          extensionBundleEmbedded: heartbeatMetadata?.extensionBundleEmbedded === true,
          extensionLastUpdatedAt:
            typeof heartbeatMetadata?.extensionLastUpdatedAt === "number"
              ? heartbeatMetadata.extensionLastUpdatedAt
              : null,
          extensionStopReason:
            typeof heartbeatMetadata?.extensionStopReason === "string"
              ? heartbeatMetadata.extensionStopReason
              : null,
          extensionOperationalState:
            typeof heartbeatMetadata?.extensionOperationalState === "string"
              ? heartbeatMetadata.extensionOperationalState
              : null,
          extensionControlMode:
            typeof heartbeatMetadata?.extensionControlMode === "string"
              ? heartbeatMetadata.extensionControlMode
              : null,
          localDomainEvaluationReady: heartbeatMetadata?.localDomainEvaluationReady === true
        }
      : null
  };
}

export async function registerProtectedDevice(input: RegisterDeviceInput) {
  const bootstrap = await getMobileBootstrap(input.userId);
  const activeDeviceLimit = bootstrap.subscription.plan.maxDevices;
  const currentDeviceCount = bootstrap.devices.filter(
    (device) => device.status === DeviceStatus.ACTIVE || device.status === DeviceStatus.PENDING
  ).length;

  const existingDevice = await prisma.protectedDevice.findUnique({
    where: { deviceFingerprint: input.deviceFingerprint }
  });

  if (!existingDevice && currentDeviceCount >= activeDeviceLimit) {
    await prisma.bypassIncident.create({
      data: {
        userId: input.userId,
        severity: BypassSeverity.MEDIUM,
        title: "Limite de dispositivos atingido",
        description: `Tentativa de registrar um novo dispositivo ${input.platform} fora do limite do plano.`
      }
    });

    throw new Error("O limite de dispositivos do plano foi atingido.");
  }

  const installationKey = existingDevice?.installationKey || randomBytes(24).toString("base64url");
  const device = await prisma.protectedDevice.upsert({
    where: {
      deviceFingerprint: input.deviceFingerprint
    },
    update: {
      userId: input.userId,
      nickname: input.nickname || existingDevice?.nickname || null,
      platform: input.platform,
      protectionMode: input.protectionMode,
      appVersion: input.appVersion || null,
      osVersion: input.osVersion || null,
      pushToken: input.pushToken || null,
      status: DeviceStatus.ACTIVE,
      installationKey,
      updatedAt: new Date()
    },
    create: {
      userId: input.userId,
      deviceFingerprint: input.deviceFingerprint,
      installationKey,
      nickname: input.nickname || null,
      platform: input.platform,
      protectionMode: input.protectionMode,
      appVersion: input.appVersion || null,
      osVersion: input.osVersion || null,
      pushToken: input.pushToken || null,
      status: DeviceStatus.ACTIVE,
      protectionStatus: ProtectionStatus.DEGRADED
    }
  });

  return {
    device,
    policy: bootstrap.policy
  };
}

function mapEventType(value: string) {
  if (value === "NON_DNS_TUNNEL_TRAFFIC") {
    return ProtectionEventType.PROXY_DETECTED;
  }

  if (value === "DNS_RELAY_ERROR") {
    return ProtectionEventType.DNS_TAMPERING;
  }

  if (value === "VPN_TUNNEL_STOPPED") {
    return ProtectionEventType.VPN_PERMISSION_REVOKED;
  }

  if (value === "DEVELOPER_OPTIONS_ENABLED" || value === "ADB_ENABLED") {
    return ProtectionEventType.APP_STOPPED;
  }

  if (Object.values(ProtectionEventType).includes(value as ProtectionEventType)) {
    return value as ProtectionEventType;
  }

  return ProtectionEventType.HEARTBEAT;
}

async function ensureOpenIncident(params: {
  userId: string;
  deviceId: string;
  title: string;
  severity: BypassSeverity;
  description: string;
}, client: Prisma.TransactionClient | typeof prisma = prisma) {
  const existing = await client.bypassIncident.findFirst({
    where: {
      userId: params.userId,
      deviceId: params.deviceId,
      title: params.title,
      resolvedAt: null
    }
  });

  if (existing) {
    return null;
  }

  return client.bypassIncident.create({
    data: {
      userId: params.userId,
      deviceId: params.deviceId,
      title: params.title,
      severity: params.severity,
      description: params.description
    }
  });
}

export async function processProtectionHeartbeat(input: HeartbeatInput) {
  const device = await prisma.protectedDevice.findFirst({
    where: {
      installationKey: input.installationKey,
      userId: input.userId
    }
  });

  if (!device) {
    throw new Error("Dispositivo não encontrado.");
  }

  const user = await prisma.appUser.findUnique({
    where: { id: input.userId }
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  assertUserHasOperationalAccess(user.status);

  const eventRows: Array<Prisma.ProtectionEventCreateInput> = [
    {
      user: { connect: { id: input.userId } },
      device: { connect: { id: device.id } },
      type: ProtectionEventType.HEARTBEAT,
      severity: BypassSeverity.LOW,
      blockedValue: input.blockedValue || null,
      matchedRule: input.matchedRule || null,
      metadata: {
        protectionStatus: input.protectionStatus,
        vpnEnabled: input.vpnEnabled,
        dnsProfileInstalled: input.dnsProfileInstalled,
        platform: input.platform || device.platform,
        protectionMode: input.protectionMode || device.protectionMode,
        appGroupConfigured: input.appGroupConfigured ?? false,
        extensionTargetReady: input.extensionTargetReady ?? false,
        extensionRunning: input.extensionRunning ?? false,
        extensionBundleEmbedded: input.extensionBundleEmbedded ?? false,
        extensionLastUpdatedAt: input.extensionLastUpdatedAt ?? null,
        extensionStopReason: input.extensionStopReason || null,
        extensionOperationalState: input.extensionOperationalState || null,
        extensionControlMode: input.extensionControlMode || null,
        localDomainEvaluationReady: input.localDomainEvaluationReady ?? false
      }
    }
  ];

  if (input.externalVpnDetected) {
    eventRows.push({
      user: { connect: { id: input.userId } },
      device: { connect: { id: device.id } },
      type: ProtectionEventType.EXTERNAL_VPN_DETECTED,
      severity: BypassSeverity.HIGH,
      metadata: {
        source: "heartbeat"
      }
    });
  }

  if (input.events?.length) {
    for (const event of input.events) {
      eventRows.push({
        user: { connect: { id: input.userId } },
        device: { connect: { id: device.id } },
        type: mapEventType(event.type),
        severity: BypassSeverity.MEDIUM,
        blockedValue: event.blockedValue || null,
        matchedRule: event.matchedRule || null
      });
    }
  }

  const incidentCreates: Array<{
    title: string;
    severity: BypassSeverity;
    description: string;
  }> = [];

  if (input.externalVpnDetected) {
    incidentCreates.push({
      severity: BypassSeverity.HIGH,
      title: "VPN externa detectada",
      description: "O dispositivo reportou uma VPN externa ativa durante o modo protegido."
    });
  }

  if (input.developerModeDetected) {
    incidentCreates.push({
      severity: BypassSeverity.MEDIUM,
      title: "Modo desenvolvedor detectado",
      description: "O app detectou modo desenvolvedor ligado enquanto a protecao estava ativa."
    });
  }

  const effectivePlatform = input.platform || device.platform;
  if (
    effectivePlatform === MobilePlatform.IOS ||
    effectivePlatform === MobilePlatform.MACOS
  ) {
    const applePlatformLabel =
      effectivePlatform === MobilePlatform.MACOS ? "macOS" : "iOS";
    const appleDeviceLabel =
      effectivePlatform === MobilePlatform.MACOS ? "Mac" : "iPhone";

    if (input.appGroupConfigured === false) {
      incidentCreates.push({
        severity: BypassSeverity.MEDIUM,
        title: `App Group ${applePlatformLabel} não configurado`,
        description:
          `O ${appleDeviceLabel} reportou que o App Group ainda não está pronto para compartilhar policy e estado entre app e extensão.`
      });
    }

    if (input.extensionTargetReady === false) {
      incidentCreates.push({
        severity: BypassSeverity.MEDIUM,
        title: `Extensão ${applePlatformLabel} não preparada`,
        description:
          `O ${appleDeviceLabel} reportou que o target da Network Extension ainda não está pronto no ambiente Apple.`
      });
    }

    if (
      effectivePlatform === MobilePlatform.MACOS &&
      input.extensionControlMode === "LOCAL_APP_ONLY" &&
      input.localDomainEvaluationReady === true
    ) {
      incidentCreates.push({
        severity: BypassSeverity.MEDIUM,
        title: "macOS em modo local sem extensão",
        description:
          "O Mac já sincronizou a policy e consegue avaliar domínios localmente, mas a extensão Apple ainda não foi embutida no app para manter bloqueio contínuo."
      });
    }

    if (input.protectionStatus === ProtectionStatus.ONLINE && input.extensionRunning === false) {
      incidentCreates.push({
        severity: BypassSeverity.HIGH,
        title: `Extensão ${applePlatformLabel} sem execução`,
        description:
          `O ${appleDeviceLabel} marcou proteção online, mas a extensão DNS Proxy ainda não reportou execução ativa.`
      });
    }

    if (input.extensionStopReason && input.extensionRunning === false) {
      incidentCreates.push({
        severity: BypassSeverity.MEDIUM,
        title: `Extensão ${applePlatformLabel} interrompida`,
        description: `A extensão ${applePlatformLabel} reportou parada recente: ${input.extensionStopReason}.`
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.protectedDevice.update({
      where: { id: device.id },
      data: {
        protectionStatus: input.protectionStatus,
        vpnEnabled: input.vpnEnabled,
        dnsProfileInstalled: input.dnsProfileInstalled,
        externalVpnDetected: input.externalVpnDetected,
        developerModeDetected: input.developerModeDetected,
        uninstallGuardEnabled: input.uninstallGuardEnabled,
        protectedByPin: input.protectedByPin,
        platform: effectivePlatform,
        protectionMode: input.protectionMode || device.protectionMode,
        lastHeartbeatAt: new Date()
      }
    });

    for (const eventData of eventRows) {
      await tx.protectionEvent.create({
        data: eventData
      });
    }

    for (const incident of incidentCreates) {
      await ensureOpenIncident({
        userId: input.userId,
        deviceId: device.id,
        title: incident.title,
        severity: incident.severity,
        description: incident.description
      }, tx);
    }
  });

  return {
    ok: true,
    deviceId: device.id,
    protectionStatus: input.protectionStatus
  };
}

export async function processLocalProtectionEvents(input: LocalProtectionEventsInput) {
  const device = await prisma.protectedDevice.findFirst({
    where: {
      installationKey: input.installationKey,
      userId: input.userId
    }
  });

  if (!device) {
    throw new Error("Dispositivo não encontrado.");
  }

  const user = await prisma.appUser.findUnique({
    where: { id: input.userId }
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  assertUserHasOperationalAccess(user.status);

  const eventRows: Array<Prisma.ProtectionEventCreateInput> = [];
  const incidentRows: Array<Prisma.BypassIncidentCreateInput> = [];

  for (const event of input.events) {
    const type = mapEventType(event.type);
    const severity =
      type === ProtectionEventType.EXTERNAL_VPN_DETECTED ||
      type === ProtectionEventType.DNS_TAMPERING ||
      type === ProtectionEventType.UNINSTALL_ATTEMPT
        ? BypassSeverity.HIGH
        : event.type === "DEVELOPER_OPTIONS_ENABLED" || event.type === "ADB_ENABLED"
          ? BypassSeverity.MEDIUM
        : type === ProtectionEventType.BLOCKED_DOMAIN || type === ProtectionEventType.BLOCKED_URL
          ? BypassSeverity.LOW
          : BypassSeverity.MEDIUM;

    eventRows.push({
      user: { connect: { id: input.userId } },
      device: { connect: { id: device.id } },
      type,
      severity,
      blockedValue: event.blockedValue || null,
      matchedRule: event.matchedRule || null,
      metadata: (event.metadata || undefined) as Prisma.InputJsonValue | undefined
    });

    if (
      type === ProtectionEventType.EXTERNAL_VPN_DETECTED ||
      type === ProtectionEventType.DNS_TAMPERING ||
      type === ProtectionEventType.UNINSTALL_ATTEMPT ||
      event.type === "DEVELOPER_OPTIONS_ENABLED" ||
      event.type === "ADB_ENABLED"
    ) {
      incidentRows.push({
        user: { connect: { id: input.userId } },
        device: { connect: { id: device.id } },
        severity,
        title:
          type === ProtectionEventType.EXTERNAL_VPN_DETECTED
            ? "VPN externa detectada"
            : type === ProtectionEventType.DNS_TAMPERING
              ? "Violação de DNS detectada"
              : event.type === "DEVELOPER_OPTIONS_ENABLED"
                ? "Modo desenvolvedor habilitado"
                : event.type === "ADB_ENABLED"
                  ? "ADB habilitado"
              : "Tentativa de remoção detectada",
        description:
          type === ProtectionEventType.EXTERNAL_VPN_DETECTED
            ? "O dispositivo registrou uso de VPN externa fora da política."
            : type === ProtectionEventType.DNS_TAMPERING
              ? "O dispositivo registrou tentativa de burlar a proteção por DNS."
              : event.type === "DEVELOPER_OPTIONS_ENABLED"
                ? "O dispositivo registrou modo desenvolvedor ativo durante a proteção."
                : event.type === "ADB_ENABLED"
                  ? "O dispositivo registrou depuração ADB ativa durante a proteção."
              : "O dispositivo registrou tentativa local de remover ou desativar a proteção."
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const eventData of eventRows) {
      await tx.protectionEvent.create({
        data: eventData
      });
    }

    for (const incidentData of incidentRows) {
      await tx.bypassIncident.create({
        data: incidentData
      });
    }
  });

  return {
    ok: true,
    received: input.events.length,
    deviceId: device.id
  };
}

export async function logoutMobileSession(input: {
  userId: string;
  sessionId: string;
}) {
  await prisma.appUserSession.updateMany({
    where: {
      id: input.sessionId,
      userId: input.userId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  return { ok: true };
}

export async function removeProtectedDevice(input: {
  userId: string;
  deviceId: string;
}) {
  const device = await prisma.protectedDevice.findFirst({
    where: {
      id: input.deviceId,
      userId: input.userId
    }
  });

  if (!device) {
    throw new Error("Dispositivo não encontrado.");
  }

  await prisma.$transaction([
    prisma.protectedDevice.update({
      where: { id: device.id },
      data: {
        status: DeviceStatus.REMOVED,
        protectionStatus: ProtectionStatus.OFFLINE,
        vpnEnabled: false,
        dnsProfileInstalled: false,
        externalVpnDetected: false,
        developerModeDetected: false,
        uninstallGuardEnabled: false,
        protectedByPin: false
      }
    }),
    prisma.protectionEvent.create({
      data: {
        userId: input.userId,
        deviceId: device.id,
        type: ProtectionEventType.APP_STOPPED,
        severity: BypassSeverity.MEDIUM,
        metadata: {
          source: "device_removed_by_user"
        }
      }
    })
  ]);

  return { ok: true, deviceId: device.id };
}

export async function authorizePinReset(input: {
  userId: string;
  deviceId?: string;
}) {
  await prisma.protectionEvent.create({
    data: {
      userId: input.userId,
      deviceId: input.deviceId || null,
      type: ProtectionEventType.APP_STOPPED,
      severity: BypassSeverity.LOW,
      metadata: {
        source: "pin_reset_authorized"
      }
    }
  });

  return {
    ok: true,
    resetAuthorizedAt: new Date().toISOString()
  };
}

export async function authorizeUninstallPreparation(input: {
  userId: string;
  deviceId?: string;
}) {
  await prisma.protectionEvent.create({
    data: {
      userId: input.userId,
      deviceId: input.deviceId || null,
      type: ProtectionEventType.UNINSTALL_ATTEMPT,
      severity: BypassSeverity.LOW,
      metadata: {
        source: "supervised_uninstall_approved",
        approved: true
      }
    }
  });

  return {
    ok: true,
    uninstallReadyAt: new Date().toISOString()
  };
}
