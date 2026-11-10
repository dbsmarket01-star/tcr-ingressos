import { PrismaClient } from "@prisma/client";
import { databaseUrlWithExplicitSchema } from "./database-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: databaseUrlWithExplicitSchema(process.env.DATABASE_URL)
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
