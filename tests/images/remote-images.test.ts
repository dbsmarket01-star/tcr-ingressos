import { describe, expect, it } from "vitest";
import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";
import config from "../../next.config";

function accepts(url: string) {
  return hasRemoteMatch([], config.images?.remotePatterns ?? [], new URL(url));
}

describe("event image optimizer origins", () => {
  it.each([
    "https://www.phsis.com.br/files/20/image/20260902165725.png",
    "https://www.phsis.com.br/files/20/image/20260731094056.png",
    "https://www.phsis.com.br/files/20/image/20260909193637.png",
    "https://www.phsis.com.br/files/20/image/20260724075418.png",
    "https://www.phsis.com.br/files/11/image/11260429224800.png",
    "https://eloconferenceglobal.com.br/event-maps/elo-caldas-novas-2026-mapa.png",
    "https://raw.githubusercontent.com/dbsmarket01-star/tcr-ingressos/main/public/events/metodo-ci-baixo-guandu-aimores/banner-metodo-ci.png",
    "https://xbvrlheevlchxdkrsbnq.supabase.co/storage/v1/object/public/event-media/events/map.png",
    "https://images.unsplash.com/photo-123"
  ])("accepts existing event media: %s", (url) => {
    expect(accepts(url)).toBe(true);
  });

  it.each([
    "http://www.phsis.com.br/files/20/image/banner.png",
    "https://www.phsis.com.br:8443/files/20/image/banner.png",
    "https://www.phsis.com.br/admin/banner.png",
    "https://www.phsis.com.br/files/20/image/banner.png?url=https://example.com",
    "https://www.phsis.com.br.evil.example/files/20/image/banner.png",
    "https://eloconferenceglobal.com.br/private/image.png",
    "https://raw.githubusercontent.com/another-owner/another-repo/main/image.png"
  ])("rejects origins and paths outside event media: %s", (url) => {
    expect(accepts(url)).toBe(false);
  });
});
