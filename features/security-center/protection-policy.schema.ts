import { z } from "zod";

export const protectionPolicySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  targetPornographyOnly: z.boolean().default(true),
  enforceAndroidVpn: z.boolean().default(true),
  enforceIosDnsProxy: z.boolean().default(true),
  blockUnknownDnsChanges: z.boolean().default(true),
  detectExternalVpn: z.boolean().default(true),
  detectProxy: z.boolean().default(true),
  detectDeveloperMode: z.boolean().default(true),
  pinRequiredToDisable: z.boolean().default(true),
  heartbeatIntervalMinutes: z.coerce.number().int().min(1).max(120).default(15),
  staleHeartbeatGraceMinutes: z.coerce.number().int().min(5).max(360).default(45)
});

export type ProtectionPolicyInput = z.infer<typeof protectionPolicySchema>;
