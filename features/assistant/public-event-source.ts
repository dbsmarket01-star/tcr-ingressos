import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

const MAX_HTML_BYTES = 350_000;

export function isPublicIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

export function parsePublicEventUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.port || url.username || url.password || isIP(url.hostname) ||
    !url.hostname.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(url.hostname)) {
    throw new Error("Use uma página pública HTTPS sem credenciais nem porta personalizada.");
  }
  return url;
}

/** DNS is resolved once and the HTTPS socket is pinned to that verified public IP. */
export async function fetchPublicEventHtml(raw: string) {
  const url = parsePublicEventUrl(raw);
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(({ address }) => !isPublicIpv4(address))) {
    throw new Error("O endereço não aponta somente para servidores públicos.");
  }
  return new Promise<{ status: number; html: string }>((resolve, reject) => {
    const req = request({
      host: addresses[0].address, port: 443, path: `${url.pathname}${url.search}`, method: "GET",
      servername: url.hostname, timeout: 8000,
      headers: { host: url.hostname, accept: "text/html", "accept-encoding": "identity", "user-agent": "TCR-Ingressos-Event-Assistant/1.0" }
    }, (res) => {
      const status = res.statusCode || 0;
      if (status !== 200) { res.resume(); resolve({ status, html: "" }); return; }
      const contentType = String(res.headers["content-type"] || "").toLowerCase();
      if (!contentType.includes("text/html")) { res.resume(); reject(new Error("O link não retornou uma página HTML.")); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_HTML_BYTES) { req.destroy(new Error("A página excede o tamanho permitido.")); return; }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ status, html: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("O site demorou para responder.")));
    req.on("error", reject);
    req.end();
  });
}
