import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { reconcileProducerClosing } from "../features/finance/producer-closing";

try {
  const path = process.argv[2];
  if (!path) throw new Error("Uso: npm run finance:reconcile -- caminho/fechamento.json");
  const source = readFileSync(path, "utf8");
  const result = reconcileProducerClosing(JSON.parse(source));
  process.stdout.write(JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    inputSha256: createHash("sha256").update(source).digest("hex"),
    ...result
  }, null, 2) + "\n");
  if (result.status === "BLOCKED") process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Fechamento inválido"}\n`);
  process.exitCode = 1;
}
