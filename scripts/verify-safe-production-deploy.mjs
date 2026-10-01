import { execFileSync } from "node:child_process";
import process from "node:process";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function fail(message, details = []) {
  console.error(`\nDEPLOY BLOQUEADO: ${message}`);
  for (const detail of details) console.error(`- ${detail}`);
  console.error("\nResolva os itens acima. Nao contorne esta verificacao para publicar em producao.\n");
  process.exit(1);
}

try {
  git("rev-parse", "--is-inside-work-tree");
} catch {
  fail("o comando precisa ser executado dentro do repositorio da TCR.");
}

const root = git("rev-parse", "--show-toplevel");
if (process.cwd() !== root) {
  fail("execute o deploy a partir da raiz do repositorio.", [`Raiz esperada: ${root}`, `Diretorio atual: ${process.cwd()}`]);
}

const inProgressMarkers = ["MERGE_HEAD", "REBASE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"];
const activeOperation = inProgressMarkers.find((marker) => {
  try {
    git("rev-parse", "--verify", "-q", marker);
    return true;
  } catch {
    return false;
  }
});
if (activeOperation) fail("ha uma operacao Git incompleta.", [`Marcador encontrado: ${activeOperation}`]);

const status = git("status", "--porcelain=v1", "--untracked-files=all");
if (status) {
  fail("existem arquivos alterados ou nao registrados.", status.split("\n").slice(0, 25));
}

const branch = git("branch", "--show-current");
if (branch !== "main") {
  fail("deploy de producao somente pode sair da branch main.", [`Branch atual: ${branch || "HEAD destacado"}`]);
}

try {
  execFileSync("git", ["fetch", "--quiet", "origin", "main"], { stdio: "inherit" });
} catch {
  fail("nao foi possivel consultar a versao central origin/main.", ["Confira internet e autenticacao do Git remoto."]);
}

const localHead = git("rev-parse", "HEAD");
const remoteHead = git("rev-parse", "origin/main");
if (localHead !== remoteHead) {
  const behind = Number(git("rev-list", "--count", "HEAD..origin/main") || 0);
  const ahead = Number(git("rev-list", "--count", "origin/main..HEAD") || 0);
  fail("a main local nao e exatamente a mesma versao registrada em origin/main.", [
    `Commits atras: ${behind}`,
    `Commits locais ainda nao enviados: ${ahead}`,
    "Sincronize, revise, envie os commits e execute novamente."
  ]);
}

console.log(`Deploy liberado: workspace limpo e main sincronizada em ${localHead.slice(0, 12)}.`);
