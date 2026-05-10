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

  it("redirects admin host root to /login", () => {
    process.env.ADMIN_HOST = "produtor.a2imergidos.com.br";

    const response = proxy(
      makeRequest("https://produtor.a2imergidos.com.br/", "produtor.a2imergidos.com.br")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://produtor.a2imergidos.com.br/login");
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
