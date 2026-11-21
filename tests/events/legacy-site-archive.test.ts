import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../data/legacy-site/manifest.json";

describe("read-only legacy TCR archive", () => {
  it("captures the former home and every listed event without executable checkout controls", () => {
    expect(manifest.events).toHaveLength(9);
    const home = readFileSync(path.join(process.cwd(), "data", "legacy-site", "home.html"), "utf8");
    for (const event of manifest.events) expect(home).toContain(`/admin/site-antigo/evento/${event.slug}`);
    for (const slug of ["home", ...manifest.events.map((event) => event.slug)]) {
      const html = readFileSync(path.join(process.cwd(), "data", "legacy-site", `${slug}.html`), "utf8");
      expect(html).toContain("TCR Ingressos");
      expect(html).toContain("noindex,nofollow");
      expect(html).not.toMatch(/<(script|form)\b/i);
      expect(html).not.toMatch(/\son[a-z]+\s*=/i);
      for (const asset of html.match(/\/site-antigo\/assets\/[^"')\s]+/g) ?? []) {
        expect(existsSync(path.join(process.cwd(), "public", asset))).toBe(true);
      }
    }
  });
});
