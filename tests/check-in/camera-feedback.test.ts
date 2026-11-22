import { expect, it } from "vitest";
import { getCameraErrorMessage } from "@/features/check-in/camera-feedback";
it("distinguishes permission, missing camera, busy camera and unavailable selection", () => {
  expect(getCameraErrorMessage({ name: "NotAllowedError" })).toContain("permissão");
  expect(getCameraErrorMessage({ name: "NotFoundError" })).toContain("Nenhuma câmera");
  expect(getCameraErrorMessage({ name: "NotReadableError" })).toContain("ocupada");
  expect(getCameraErrorMessage({ name: "OverconstrainedError" })).toContain("Traseira automática");
  expect(getCameraErrorMessage({ name: "Unknown" })).toContain("digite o código");
});
