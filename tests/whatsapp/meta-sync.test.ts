import { describe, expect, it } from "vitest";
import {
  META_HEALTH_SYNC_BLOCK,
  integrationBlockAfterSync,
} from "@/features/whatsapp/campaigns/meta";

describe("WhatsApp integration sync circuit", () => {
  it("clears the stale health-sync block after a healthy synchronization", () => {
    expect(integrationBlockAfterSync(META_HEALTH_SYNC_BLOCK, null)).toEqual({
      blockedReason: null,
      blockedUntil: null,
    });
  });

  it("does not clear a safety block that requires manual investigation", () => {
    expect(
      integrationBlockAfterSync(
        "Envio interrompido sem confirmação. Não reenviar automaticamente.",
        null,
      ),
    ).toEqual({});
  });

  it("keeps a current Meta health block authoritative", () => {
    expect(
      integrationBlockAfterSync(META_HEALTH_SYNC_BLOCK, "Número: FLAGGED"),
    ).toEqual({ blockedReason: "Número: FLAGGED", blockedUntil: null });
  });
});
