import { describe, expect, it } from "vitest";
import { formatCpf } from "@/lib/format";

describe("formatCpf", () => {
  it("formats an unmasked CPF", () => {
    expect(formatCpf("12345678901")).toBe("123.456.789-01");
  });

  it("keeps a masked CPF consistently formatted", () => {
    expect(formatCpf("123.456.789-01")).toBe("123.456.789-01");
  });

  it("identifies an absent CPF", () => {
    expect(formatCpf(null)).toBe("Não informado");
  });
});
