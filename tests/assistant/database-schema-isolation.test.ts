import { describe, expect, it } from "vitest";
import { databaseUrlWithExplicitSchema } from "@/lib/database-url";

describe("database schema isolation", () => {
  it("pins the default schema instead of inheriting another pool session", () => {
    const url = new URL(databaseUrlWithExplicitSchema("postgresql://test:password@localhost/db?pgbouncer=true")!);
    expect(url.searchParams.get("schema")).toBe("public");
    expect(url.searchParams.get("pgbouncer")).toBe("true");
  });
  it("preserves an explicitly configured isolated schema", () => {
    expect(new URL(databaseUrlWithExplicitSchema("postgresql://localhost/db?schema=isolated_audit")!).searchParams.get("schema")).toBe("isolated_audit");
  });
  it("does not fabricate a missing connection", () => expect(databaseUrlWithExplicitSchema(undefined)).toBeUndefined());
});
