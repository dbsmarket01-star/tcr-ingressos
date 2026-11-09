import { describe, expect, it } from "vitest";
import { isPublicIpv4, parsePublicEventUrl } from "@/features/assistant/public-event-source";

describe("public event source", () => {
  it("rejects private, link-local and reserved addresses", () => {
    for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "192.0.2.1", "198.51.100.1", "203.0.113.1"]) {
      expect(isPublicIpv4(address)).toBe(false);
    }
    expect(isPublicIpv4("8.8.8.8")).toBe(true);
  });

  it("accepts only credential-free public HTTPS page URLs", () => {
    expect(parsePublicEventUrl("https://ingressos.exemplo.com.br/evento/show").hostname).toBe("ingressos.exemplo.com.br");
    for (const raw of ["http://ingressos.exemplo.com.br", "https://localhost/admin", "https://127.0.0.1/", "https://u:p@ingressos.exemplo.com.br/", "https://ingressos.exemplo.com.br:8443/"]) {
      expect(() => parsePublicEventUrl(raw)).toThrow();
    }
  });
});
