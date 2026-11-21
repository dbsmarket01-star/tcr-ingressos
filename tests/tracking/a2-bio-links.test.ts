import { describe, expect, it } from "vitest";
import { getA2BioDestination } from "@/features/tracking/a2-bio";

describe("A2 Instagram bio links", () => {
  it("sends the general link to all A2 events with distinct attribution", () => {
    const url = getA2BioDestination("https://www.a2imergidos.com.br/bio/a2", "geral");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("utm_campaign")).toBe("bio_a2_geral");
    expect(url.searchParams.get("utm_source")).toBe("instagram");
  });

  it("sends the Gramado link to the event with its own attribution", () => {
    const url = getA2BioDestination("https://www.a2imergidos.com.br/bio/a2/gramado", "gramado");
    expect(url.pathname).toBe("/evento/a2-imergidos-gramado-2027");
    expect(url.searchParams.get("utm_campaign")).toBe("bio_a2_gramado_2027");
  });
});
