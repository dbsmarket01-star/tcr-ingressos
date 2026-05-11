import { prisma } from "@/lib/prisma";

export async function listHotelsForOrganization(organizationId: string) {
  return prisma.hotel.findMany({
    where: {
      organizationId
    },
    orderBy: [
      {
        name: "asc"
      },
      {
        city: "asc"
      }
    ]
  });
}
