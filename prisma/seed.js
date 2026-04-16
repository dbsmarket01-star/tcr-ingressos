const { PrismaClient, AdminRole } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@tcringressos.com.br";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "troque-esta-senha";
  const adminName = process.env.SEED_ADMIN_NAME || "Administrador TCR";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.companySettings.upsert({
    where: {
      id: "tcr-company-settings"
    },
    update: {
      companyName: "TCR Ingressos",
      tradeName: "TCR Ingressos",
      supportEmail: adminEmail,
      defaultCurrency: "BRL"
    },
    create: {
      id: "tcr-company-settings",
      companyName: "TCR Ingressos",
      tradeName: "TCR Ingressos",
      document: "00.000.000/0001-00",
      supportEmail: adminEmail,
      defaultCurrency: "BRL",
      platformFeeBps: 1000
    }
  });

  await prisma.adminUser.upsert({
    where: {
      email: adminEmail
    },
    update: {
      name: adminName,
      passwordHash,
      role: AdminRole.OWNER,
      isActive: true
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: AdminRole.OWNER,
      isActive: true
    }
  });

  console.log("Seed inicial da TCR Ingressos concluido.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
