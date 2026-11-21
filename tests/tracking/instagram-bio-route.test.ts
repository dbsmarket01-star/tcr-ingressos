import { describe, expect, it } from "vitest";
import { GET } from "@/app/bio/route";
import { GET as getA2Gramado } from "@/app/g/route";

describe("Instagram bio shortcut", () => {
  it("redirects to all events with the bio attribution", () => {
    const response = GET(new Request("https://www.tcringressos.app.br/bio"));
    const destination = new URL(response.headers.get("location")!);

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(destination.pathname).toBe("/");
    expect(destination.searchParams.get("utm_source")).toBe("instagram");
    expect(destination.searchParams.get("utm_medium")).toBe("organic_social");
    expect(destination.searchParams.get("utm_campaign")).toBe("bio_tcr");
    expect(destination.searchParams.get("utm_content")).toBe("perfil");
  });

  it("attributes the A2 general bio link to A2 without changing the TCR link", () => {
    const response = GET(new Request("https://www.a2imergidos.com.br/bio"));
    const destination = new URL(response.headers.get("location")!);
    expect(response.status).toBe(307);
    expect(destination.pathname).toBe("/");
    expect(destination.searchParams.get("utm_campaign")).toBe("bio_a2_geral");
  });

  it("sends the A2 Gramado shortcut to the event with separate attribution", () => {
    const response = getA2Gramado(new Request("https://www.a2imergidos.com.br/g"));
    const destination = new URL(response.headers.get("location")!);
    expect(response.status).toBe(307);
    expect(destination.pathname).toBe("/evento/a2-imergidos-gramado-2027");
    expect(destination.searchParams.get("utm_campaign")).toBe("bio_a2_gramado_2027");
  });

  it("does not expose the A2 shortcut on unrelated hosts", () => {
    expect(getA2Gramado(new Request("https://www.tcringressos.app.br/g")).status).toBe(404);
  });
});
