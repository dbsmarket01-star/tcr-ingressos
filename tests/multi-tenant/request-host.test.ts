import { describe, expect, it } from "vitest";
import { normalizeHost } from "@/lib/request-host";
import { isPlatformHost } from "@/features/platform/platform.service";

describe("multi-tenant host normalization", () => {
  it("normalizes host with protocol, path and port", () => {
    expect(normalizeHost("https://produtor.a2imergidos.com.br:443/login")).toBe(
      "produtor.a2imergidos.com.br"
    );
  });

  it("uses the first forwarded host when a comma-separated header is received", () => {
    expect(normalizeHost("www.a2imergidos.com.br, proxy.local")).toBe("www.a2imergidos.com.br");
  });

  it("recognizes platform host with and without www", () => {
    expect(isPlatformHost("ingresaas.app.br")).toBe(true);
    expect(isPlatformHost("www.ingresaas.app.br")).toBe(true);
    expect(isPlatformHost("a2imergidos.com.br")).toBe(false);
  });
});
