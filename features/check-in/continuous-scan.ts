/** One request at a time; keep the result readable and suppress a QR held in view. */
export class ContinuousScanGate {
  private busy = false;
  private readyAt = 0;
  private lastCode = "";
  private emptySince: number | null = null;
  observeEmptyFrame(now = Date.now()) {
    if (this.busy || !this.lastCode) return;
    this.emptySince ??= now;
    if (now - this.emptySince >= 3000) this.lastCode = "";
  }
  claim(code: string, now = Date.now()) {
    this.emptySince = null;
    if (this.busy || now < this.readyAt || code === this.lastCode) return false;
    this.busy = true;
    this.lastCode = code;
    return true;
  }
  pause() { this.busy = true; }
  complete(now = Date.now()) { this.busy = false; this.readyAt = now + 2000; }
}
export type LiveCheckInResult = {
  status: "APPROVED" | "ALREADY_USED" | "INVALID" | "CANCELED" | "ERROR";
  message: string;
  ticket?: { code: string; buyerName: string; lotName: string; checkedAt?: string };
};
