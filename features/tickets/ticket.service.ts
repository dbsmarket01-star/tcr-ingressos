import { prisma } from "@/lib/prisma";

export async function getTicketByCode(code: string, organizationId?: string | null) {
  return prisma.ticket.findFirst({
    where: {
      code,
      ...(organizationId ? { event: { organizationId } } : {})
    },
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
