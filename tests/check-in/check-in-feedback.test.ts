import { describe, expect, it } from "vitest";
import { getCheckInFeedback, getUnknownCodeFeedback, wrongEventFeedback } from "@/features/check-in/check-in-feedback";

describe("mensagens da portaria", () => {
  it("distingue ingresso já usado e cancelado", () => {
    expect(getCheckInFeedback("ALREADY_USED")).toContain("já teve a entrada registrada");
    expect(getCheckInFeedback("CANCELED")).toContain("foi cancelado");
    expect(getCheckInFeedback("INVALID")).toContain("invalidado");
  });

  it("distingue código TCR desconhecido de QR alheio", () => {
    expect(getUnknownCodeFeedback("ING-DC888762B66368DB")).toContain("não encontrado neste evento");
    expect(getUnknownCodeFeedback("https://padaria.example/compra")).toContain("outro serviço");
  });

  it("orienta trocar o evento sem liberar a entrada", () => {
    expect(wrongEventFeedback).toContain("Selecione o evento correto");
    expect(wrongEventFeedback).toContain("não libere");
  });
});
