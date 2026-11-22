import { describe, expect, it } from "vitest";
import { ContinuousScanGate } from "@/features/check-in/continuous-scan";

describe("continuous check-in scan gate", () => {
  it("allows one validation at a time and waits before the next QR", () => {
    const gate = new ContinuousScanGate();
    expect(gate.claim("QR-A", 100)).toBe(true);
    expect(gate.claim("QR-B", 101)).toBe(false);
    gate.complete(500);
    expect(gate.claim("QR-B", 2499)).toBe(false);
    expect(gate.claim("QR-B", 2500)).toBe(true);
  });

  it("does not resubmit a QR held in front of the camera", () => {
    const gate = new ContinuousScanGate();
    expect(gate.claim("QR-A", 100)).toBe(true);
    gate.complete(200);
    gate.observeEmptyFrame(300);
    gate.observeEmptyFrame(1200);
    expect(gate.claim("QR-A", 2200)).toBe(false);
    gate.observeEmptyFrame(2201);
    gate.observeEmptyFrame(5202);
    expect(gate.claim("QR-A", 5203)).toBe(true);
  });

  it("continues with a different QR after validation", () => {
    const gate = new ContinuousScanGate();
    expect(gate.claim("QR-A", 100)).toBe(true);
    gate.complete(200);
    expect(gate.claim("QR-B", 2200)).toBe(true);
  });
});
