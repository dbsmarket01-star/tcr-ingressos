import "dotenv/config";
import { workerTick } from "../features/whatsapp/campaigns/worker";
import { prisma } from "../lib/prisma";
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
async function main() {
  if (!process.argv.includes("--run"))
    throw new Error(
      "Use --run para iniciar o worker de campanhas confirmadas.",
    );
  while (!stopped) {
    try {
      await workerTick(45000);
    } catch (e) {
      console.error("[wa-worker]", e instanceof Error ? e.name : "failure");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  await prisma.$disconnect();
}
main().catch(() => {
  process.exitCode = 1;
});
