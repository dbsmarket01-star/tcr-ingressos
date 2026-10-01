import process from "node:process";

const targets = [
  ["Site publico", "https://www.tcringressos.app.br/"],
  ["Saude da API", "https://www.tcringressos.app.br/api/health"],
  ["Painel do produtor", "https://produtor.tcringressos.app.br/admin/crm/whatsapp"]
];

let failed = false;
for (const [label, url] of targets) {
  try {
    const startedAt = Date.now();
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    const elapsed = Date.now() - startedAt;
    const accepted = response.status >= 200 && response.status < 400;
    console.log(`${accepted ? "OK" : "FALHA"} ${label}: HTTP ${response.status} em ${elapsed} ms`);
    if (!accepted) failed = true;
  } catch (error) {
    failed = true;
    console.error(`FALHA ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) {
  console.error("A verificacao basica de producao falhou. Inspecione o deploy antes de encerrar a tarefa.");
  process.exit(1);
}
