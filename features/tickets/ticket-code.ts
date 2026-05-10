import crypto from "crypto";

export function createTicketCode() {
  return `ING-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

export function createQrCodeToken() {
  return crypto.randomBytes(32).toString("base64url");
}
