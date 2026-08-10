import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import "dotenv/config";
import { Client } from "pg";

type MigrationRow = {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  logs: string | null;
};

const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

function sha256(filePath: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function migrationFilePath(name: string) {
  return path.join(migrationsDir, name, "migration.sql");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao configurada. Nao foi possivel conferir o historico de migracoes.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query<MigrationRow>(
      `select migration_name, checksum, finished_at, rolled_back_at, logs
       from _prisma_migrations
       order by started_at asc`,
    );

    const missingFiles: string[] = [];
    const checksumMismatches: string[] = [];
    const failedOrRolledBack: string[] = [];

    for (const row of result.rows) {
      const filePath = migrationFilePath(row.migration_name);

      if (!fs.existsSync(filePath)) {
        missingFiles.push(row.migration_name);
        continue;
      }

      if (sha256(filePath) !== row.checksum) {
        checksumMismatches.push(row.migration_name);
      }

      if (!row.finished_at || row.rolled_back_at || row.logs) {
        failedOrRolledBack.push(row.migration_name);
      }
    }

    if (missingFiles.length || checksumMismatches.length || failedOrRolledBack.length) {
      console.error("Historico de migracoes Prisma inconsistente.");
      console.error(JSON.stringify({ missingFiles, checksumMismatches, failedOrRolledBack }, null, 2));
      process.exitCode = 1;
      return;
    }

    console.log(
      `Historico de migracoes Prisma OK: ${result.rows.length} migracoes aplicadas, ` +
        "0 arquivos faltando, 0 checksums divergentes.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
