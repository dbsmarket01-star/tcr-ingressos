import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type Finding = {
  path: string;
  reason: string;
};

const ignoredPrefixes = [
  "node_modules/",
  ".next/",
  ".vercel/",
  "tmp/",
  "tmp-",
  "dist/",
  "out/",
];

const suspiciousPatterns = [
  { pattern: /(^|\/)\.DS_Store$/, reason: "arquivo local do macOS" },
  { pattern: /(^|\/).+ [23]\.[^/]+$/, reason: "copia local numerada, exemplo: page 2.tsx" },
  { pattern: /(^|\/).+ copy\.[^/]+$/, reason: "copia local/manual" },
  { pattern: /(^|\/)tsconfig( [0-9]+)?\.tsbuildinfo$/, reason: "cache de TypeScript" },
  { pattern: /(^|\/).+\.tsbuildinfo$/, reason: "cache de TypeScript" },
  { pattern: /(^|\/).+~$/, reason: "arquivo temporario de editor" },
];

function git(args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function listFiles(args: string[]) {
  const output = git(args).trim();
  return output ? output.split("\n").filter(Boolean) : [];
}

function isIgnoredPath(filePath: string) {
  return ignoredPrefixes.some((prefix) => filePath.startsWith(prefix));
}

function inspectFile(filePath: string): Finding | null {
  const normalized = filePath.split(path.sep).join("/");

  if (!fs.existsSync(normalized)) {
    return null;
  }

  if (isIgnoredPath(normalized)) {
    return null;
  }

  for (const rule of suspiciousPatterns) {
    if (rule.pattern.test(normalized)) {
      return { path: normalized, reason: rule.reason };
    }
  }

  return null;
}

function main() {
  const files = [
    ...listFiles(["ls-files"]),
    ...listFiles(["ls-files", "--others", "--exclude-standard"]),
  ];

  const findings = files.map(inspectFile).filter((finding): finding is Finding => Boolean(finding));

  if (findings.length) {
    console.error("Higiene do repositorio falhou. Arquivos suspeitos encontrados:");
    for (const finding of findings) {
      console.error(`- ${finding.path}: ${finding.reason}`);
    }
    process.exit(1);
  }

  console.log("Higiene do repositorio OK: nenhum arquivo duplicado/cache/local suspeito encontrado.");
}

main();
