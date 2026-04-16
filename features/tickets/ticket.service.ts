import { prisma } from "@/lib/prisma";

export async function getTicketByCode(code: string) {
  return prisma.ticket.findUnique({
    where: { code },
    include: {
      event: true,
      lot: true,
      order: {
        include: {
          customer: true
        }
      },
      participant: true,
      checkIns: {
        orderBy: {
          checkedAt: "desc"
        },
        take: 5
      }
    }
  });
}
