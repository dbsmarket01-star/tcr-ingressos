import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function hasCurrentPrismaModels(client: PrismaClient | undefined) {
  return Boolean(client && "paymentSplitRule" in client);
}

export const prisma = hasCurrentPrismaModels(globalForPrisma.prisma)
  ? globalForPrisma.prisma!
  : new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
