/** One-time, read-only capture of the former public TCR storefront. Never fetch checkout or customer pages. */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const origin = "https://tcringressos.com.br/";
const archiveRoot = path.resolve("data/legacy-site");
const assetRoot = path.resolve("public/site-antigo/assets");
const eventPaths = [
  ["geriatricus-em-santo-andre-2026", "Geriatricus em Santo André", "0hwVgLowlRH4438I_oGnKbailkaEyKOxd%2AEACpYKgF8%3A"],
  ["geriatricus-em-suzano-2026", "Geriatricus em Suzano", "0hwVgLowlRH4438I_oGnKZLEC6tPpb7kqlfiHApapos%3A"],
  ["rodrigo-teaser-em-marilia-2026", "Rodrigo Teaser em Marília", "0hwVgLowlRH4438I_oGnKTZEwjTa0AyjtvEsx%2Ae1wLM%3A"],
  ["rodrigo-teaser-em-taubate-2026", "Rodrigo Teaser em Taubaté", "0hwVgLowlRH4438I_oGnKfY465tNWRwtAKdF1oWg0Ws%3A"],
  ["rodrigo-teaser-em-piracicaba-2026", "Rodrigo Teaser em Piracicaba", "0hwVgLowlRH4438I_oGnKW3NmayPU%2A_n2sR605GN9ec%3A"],
  ["rodrigo-teaser-em-sao-caetano-do-sul-2026", "Rodrigo Teaser em São Caetano do Sul", "0hwVgLowlRH4438I_oGnKSUWYslKqBDWMG1436FUqW4%3A"],
  ["rodrigo-teaser-em-sorocaba-2026", "Rodrigo Teaser em Sorocaba", "0hwVgLowlRH4438I_oGnKWBPB%2AkK2lPQn97fBv8Zo6c%3A"],
  ["guilherme-arantes-em-sao-caetano-do-sul-2027", "Guilherme Arantes em São Caetano do Sul", "HDyXwCcXvS6DhuU9I9s_yioj9%2AwLDONhafKRx59oVGk%3A"],
  ["tunel-do-tempo-em-santo-andre-2027", "Túnel do Tempo em Santo André", "0hwVgLowlRH4438I_oGnKdTMXQRtrpG%2AMTgjxLQVjzI%3A"]
];
const bySourcePath = new Map(eventPaths.map(([slug, , sourcePath]) => [decodeURIComponent(sourcePath), slug]));
const capturedAssets = new Set();
const queuedAssets = new Map();
const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==", "base64");
const emptySvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

function fetchPublic(url) {
  const parsed = new URL(url);
  const args = ["-fsSL", "--max-time", "20"];
  if (parsed.hostname === "tcringressos.com.br" || parsed.hostname === "www.tcringressos.com.br") {
    args.push("--resolve", `${parsed.hostname}:443:177.234.146.234`);
  }
  args.push(url);
  return execFileSync("curl", args, { maxBuffer: 15 * 1024 * 1024 });
}

function assetTarget(input, base) {
  let url;
  try { url = new URL(input.replaceAll("&amp;", "&"), base); } catch { return null; }
  let subpath;
  if (["tcringressos.com.br", "www.tcringressos.com.br"].includes(url.hostname) &&
      (url.pathname.startsWith("/assets/") || url.pathname === "/favicon.png")) {
    subpath = `tcr${url.pathname}`;
  } else if (url.hostname === "www.phsis.com.br" && url.pathname.startsWith("/files/")) {
    subpath = `phsis${url.pathname}`;
  } else {
    return null;
  }
  const relative = subpath.replace(/^\//, "");
  const safePath = path.resolve(assetRoot, relative);
  if (!safePath.startsWith(`${assetRoot}${path.sep}`)) return null;
  queuedAssets.set(url.href, safePath);
  return `/site-antigo/assets/${relative}`;
}

function rewriteAssetRefs(source, base) {
  return source
    .replace(/((?:src|href|poster)\s*=\s*["'])([^"']+)(["'])/gi, (full, before, value, after) => {
      const local = assetTarget(value, base);
      return local ? `${before}${local}${after}` : full;
    })
    .replace(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/gi, (full, quote, value) => {
      const local = assetTarget(value, base);
      return local ? `url(${quote}${local}${quote})` : full;
    });
}

function sanitize(html, sourceUrl) {
  let result = html
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<loader\b[^>]*>[\s\S]*?<\/loader>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/<button\b([^>]*)>/gi, "<button$1 disabled aria-disabled=\"true\">");
  result = rewriteAssetRefs(result, sourceUrl);
  result = result.replace(/(href\s*=\s*["'])([^"']+)(["'])/gi, (full, before, value, after) => {
    if (value.startsWith("/site-antigo/assets/")) return full;
    let target;
    try { target = new URL(value, sourceUrl); } catch { return `${before}#${after}`; }
    if (!["tcringressos.com.br", "www.tcringressos.com.br"].includes(target.hostname)) return `${before}#${after}`;
    const key = decodeURIComponent(target.pathname.slice(1));
    if (key === "" || key === "home" || key === "index.php") return `${before}/admin/site-antigo${after}`;
    const slug = bySourcePath.get(key);
    return slug ? `${before}/admin/site-antigo/evento/${slug}${after}` : `${before}#${after}`;
  });
  return result.replace(/<head([^>]*)>/i, `<head$1><base href="/site-antigo/" target="_top"><meta name="robots" content="noindex,nofollow"><style>.wow{visibility:visible!important}a[href="#"],button[disabled]{cursor:not-allowed!important}</style>`);
}

mkdirSync(archiveRoot, { recursive: true });
mkdirSync(assetRoot, { recursive: true });
const entries = [["home", "Acervo TCR Ingressos", "home"], ...eventPaths];
for (const [slug, title, sourcePath] of entries) {
  const sourceUrl = new URL(sourcePath, origin).href;
  const original = fetchPublic(sourceUrl).toString("utf8");
  if (!original.includes("TCR Ingressos") || !original.includes("</html>")) throw new Error(`Invalid source: ${slug}`);
  writeFileSync(path.join(archiveRoot, `${slug}.html`), sanitize(original, sourceUrl));
  console.log(`Captured ${slug} (${original.length} characters)`);
}
while (queuedAssets.size) {
  const [url, destination] = queuedAssets.entries().next().value;
  queuedAssets.delete(url);
  if (capturedAssets.has(destination)) continue;
  capturedAssets.add(destination);
  try {
    const bytes = fetchPublic(url);
    mkdirSync(path.dirname(destination), { recursive: true });
    const looksLikeHtml = /^\s*(?:<!doctype html|<html\b)/i.test(bytes.toString("utf8", 0, 100));
    if (looksLikeHtml && !destination.endsWith(".html")) {
      if (!destination.endsWith(".png") && !destination.endsWith(".svg")) throw new Error("server returned HTML instead of asset");
      console.warn(`Missing original image, using transparent placeholder: ${new URL(url).pathname}`);
    }
    const content = looksLikeHtml ? (destination.endsWith(".svg") ? emptySvg : transparentPixel) : destination.endsWith(".css") ? rewriteAssetRefs(bytes.toString("utf8"), url) : bytes;
    writeFileSync(destination, content);
  } catch (error) {
    console.warn(`Asset unavailable: ${new URL(url).pathname} (${error.message})`);
  }
}
writeFileSync(path.join(archiveRoot, "manifest.json"), JSON.stringify({
  capturedAt: new Date().toISOString(),
  events: eventPaths.map(([slug, title]) => ({ slug, title }))
}, null, 2));
console.log(`Captured ${capturedAssets.size} assets`);
