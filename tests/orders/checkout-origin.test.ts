import { describe, expect, it } from "vitest";
import { resolveCheckoutLandingPage } from "@/features/orders/checkout-origin";

describe("checkout sales-domain attribution", () => {
  it("records the actual .com.br checkout host", () => {
    expect(resolveCheckoutLandingPage("/evento/show?utm_source=ig", "www.tcringressos.com.br"))
      .toBe("https://www.tcringressos.com.br/evento/show?utm_source=ig");
  });

  it("records the .app.br checkout host separately", () => {
    expect(resolveCheckoutLandingPage("/evento/show", "tcringressos.app.br"))
      .toBe("https://tcringressos.app.br/evento/show");
  });

  it("does not trust an unrelated host", () => {
    expect(resolveCheckoutLandingPage("/evento/show", "unknown.example"))
      .toBe("/evento/show");
  });
});
