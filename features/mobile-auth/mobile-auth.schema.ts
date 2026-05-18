import { MobilePlatform, ProtectionMode, ProtectionStatus } from "@prisma/client";
import { z } from "zod";

export const appUserRegistrationSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  planCode: z.string().trim().optional(),
  accountabilityEmail: z.string().trim().email("Informe um e-mail valido.").optional()
});

export const appUserLoginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string().min(8, "Informe sua senha."),
  deviceLabel: z.string().trim().max(80).optional()
});

export const deviceRegistrationSchema = z.object({
  deviceFingerprint: z.string().trim().min(16, "Fingerprint inválido."),
  nickname: z.string().trim().max(80).optional(),
  platform: z.nativeEnum(MobilePlatform),
  protectionMode: z.nativeEnum(ProtectionMode),
  appVersion: z.string().trim().max(32).optional(),
  osVersion: z.string().trim().max(32).optional(),
  pushToken: z.string().trim().max(255).optional()
});

export const heartbeatSchema = z.object({
  installationKey: z.string().trim().min(20, "installationKey inválido."),
  protectionStatus: z.nativeEnum(ProtectionStatus),
  vpnEnabled: z.boolean().default(false),
  dnsProfileInstalled: z.boolean().default(false),
  externalVpnDetected: z.boolean().default(false),
  developerModeDetected: z.boolean().default(false),
  uninstallGuardEnabled: z.boolean().default(false),
  protectedByPin: z.boolean().default(false),
  platform: z.nativeEnum(MobilePlatform).optional(),
  protectionMode: z.nativeEnum(ProtectionMode).optional(),
  appGroupConfigured: z.boolean().optional(),
  extensionTargetReady: z.boolean().optional(),
  extensionRunning: z.boolean().optional(),
  extensionBundleEmbedded: z.boolean().optional(),
  extensionLastUpdatedAt: z.number().optional(),
  extensionStopReason: z.string().trim().max(120).optional(),
  extensionOperationalState: z.string().trim().max(40).optional(),
  extensionControlMode: z.string().trim().max(40).optional(),
  localDomainEvaluationReady: z.boolean().optional(),
  blockedValue: z.string().trim().max(255).optional(),
  matchedRule: z.string().trim().max(255).optional(),
  events: z
    .array(
      z.object({
        type: z.string().trim().min(3),
        blockedValue: z.string().trim().max(255).optional(),
        matchedRule: z.string().trim().max(255).optional()
      })
    )
    .max(20)
    .optional()
});

export const localProtectionEventsSchema = z.object({
  installationKey: z.string().trim().min(20, "installationKey inválido."),
  events: z
    .array(
      z.object({
        type: z.string().trim().min(3),
        blockedValue: z.string().trim().max(255).optional(),
        matchedRule: z.string().trim().max(255).optional(),
        metadata: z.record(z.string(), z.unknown()).optional()
      })
    )
    .min(1)
    .max(50)
});

export const unlockRequestSchema = z.object({
  deviceId: z.string().trim().optional(),
  actionType: z.enum([
    "DISABLE_PROTECTION",
    "REMOVE_DEVICE",
    "REQUEST_UNINSTALL",
    "RESET_PIN",
    "LOGOUT_DEVICE"
  ]),
  reason: z.string().trim().max(500).optional()
});

export const unlockApprovalSchema = z.object({
  unlockRequestId: z.string().trim().min(8),
  approvalCode: z.string().trim().min(4).max(32)
});

export const protectedActionAttemptSchema = z.object({
  deviceId: z.string().trim().optional(),
  actionType: z.enum([
    "DISABLE_PROTECTION",
    "REMOVE_DEVICE",
    "REQUEST_UNINSTALL",
    "RESET_PIN",
    "LOGOUT_DEVICE"
  ]),
  reason: z.string().trim().max(500).optional()
});
