import { describe, expect, it } from "vitest";
import { assistantSourcePathIsSafe } from "@/features/assistant/assistant-investigation";

describe("assistant code investigation boundaries", () => {
  it("allows repository source paths", () => {
    expect(assistantSourcePathIsSafe("features/assistant/admin-assistant.service.ts")).toBe(true);
    expect(assistantSourcePathIsSafe("app/api/admin/assistant/route.ts")).toBe(true);
  });

  it("rejects secrets and path traversal", () => {
    expect(assistantSourcePathIsSafe(".env.local")).toBe(false);
    expect(assistantSourcePathIsSafe("../.env.local")).toBe(false);
    expect(assistantSourcePathIsSafe("src/../../.env.local")).toBe(false);
    expect(assistantSourcePathIsSafe("node_modules/pkg/index.ts")).toBe(false);
    expect(assistantSourcePathIsSafe("https://example.com/file.ts")).toBe(false);
  });
});
