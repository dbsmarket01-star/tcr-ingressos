import { describe, expect, it } from "vitest";
import { GET } from "@/app/bio/route";

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
});
