import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { normalizedHost, proxy } from "@/proxy";

function makeRequest(url: string, host: string, extraHeaders?: Record<string, string>) {
  return new NextRequest(url, {
    headers: {
      host,
      ...extraHeaders
    }
  });
}

describe("multi-tenant proxy isolation", () => {
  it("normalizes forwarded hosts with protocol, port and comma suffix", () => {
    expect(normalizedHost("https://a2imergidos.com.br:443/login, proxy.local")).toBe("a2imergidos.com.br");
  });

  it("blocks public routes on the admin host", () => {
    process.env.ADMIN_HOST = "produtor.a2imergidos.com.br,produtor.tcringressos.app.br";

    const response = proxy(
      makeRequest("https://produtor.a2imergidos.com.br/evento/teste", "produtor.a2imergidos.com.br")
    );

    expect(response.status).toBe(404);
  });

  it("rewrites unauthenticated admin host root to /login", () => {
    process.env.ADMIN_HOST = "produtor.a2imergidos.com.br";

    const response = proxy(
      makeRequest("https://produtor.a2imergidos.com.br/", "produtor.a2imergidos.com.br")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://produtor.a2imergidos.com.br/login");
  });

  it("allows the same-origin camera on internal admin pages", () => {
    process.env.ADMIN_HOST = "produtor.tcringressos.app.br";

    const response = proxy(
      makeRequest(
        "https://produtor.tcringressos.app.br/admin/check-in",
        "produtor.tcringressos.app.br"
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(self), microphone=(), geolocation=()"
    );
  });

  it("blocks /login on a public child host", () => {
    process.env.ADMIN_HOST = "produtor.a2imergidos.com.br";

    const response = proxy(makeRequest("https://a2imergidos.com.br/login", "a2imergidos.com.br"));

    expect(response.status).toBe(404);
  });

  it("uses forwarded host before the internal localhost URL", () => {
    process.env.ADMIN_HOST = "produtor.a2imergidos.com.br";

    const response = proxy(
      makeRequest("http://127.0.0.1:3000/login", "127.0.0.1:3000", {
        "x-forwarded-host": "a2imergidos.com.br"
      })
    );

    expect(response.status).toBe(404);
  });

  it("allows /login on the platform master host", () => {
    process.env.ADMIN_HOST = "produtor.a2imergidos.com.br";
    process.env.PLATFORM_DOMAIN = "ingresaas.app.br";

    const response = proxy(makeRequest("https://ingresaas.app.br/login", "ingresaas.app.br"));

    expect(response.status).toBe(200);
  });
});


describe("admin mobile session and media", () => {
  it("prevents caching private pages without disabling static asset caching", () => {
    process.env.ADMIN_HOST = "produtor.tcringressos.app.br";
    for (const path of ["/", "/admin", "/admin/orders", "/login", "/api/admin/events"]) {
      const response = proxy(makeRequest(`https://produtor.tcringressos.app.br${path}`, "produtor.tcringressos.app.br"));
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    const asset = proxy(makeRequest("https://produtor.tcringressos.app.br/uploads/banner.png", "produtor.tcringressos.app.br"));
    expect(asset.headers.get("cache-control")).toBeNull();
  });
  it("allows recording audio only on the WhatsApp conversation page", () => {
    process.env.ADMIN_HOST = "produtor.tcringressos.app.br";
    const response = proxy(makeRequest("https://produtor.tcringressos.app.br/admin/crm/whatsapp", "produtor.tcringressos.app.br"));
    expect(response.headers.get("permissions-policy")).toContain("microphone=(self)");
    const other = proxy(makeRequest("https://produtor.tcringressos.app.br/admin/orders", "produtor.tcringressos.app.br"));
    expect(other.headers.get("permissions-policy")).toContain("microphone=()");
  });
});
