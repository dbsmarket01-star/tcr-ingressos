import { CheckInStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCheckInDecision } from "./check-in-policy";

export type CheckInResult = {
  status: CheckInStatus;
  message: string;
  ticket?: {
    code: string;
    eventTitle: string;
    lotName: string;
    buyerName: string;
    checkedAt?: Date;
  };
};

export async function validateTicketForCheckIn(inputCode: string, deviceName?: string) {
  const code = inputCode.trim();

  if (!code) {
    return {
      status: CheckInStatus.INVALID,
      message: "Informe um codigo de ingresso."
    };
  }

  return prisma.$transaction(
    async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: {
          OR: [{ code }, { qrCodeToken: code }]
        },
        include: {
          event: true,
          lot: true,
          order: {
            include: {
              customer: true
            }
          }
        }
      });

      const decision = getCheckInDecision(ticket ?? undefined);

      if (!ticket) {
        return {
          status: CheckInStatus.INVALID,
          message: "Ingresso nao encontrado."
        };
      }

      if (decision !== "APPROVED") {
        await tx.checkIn.create({
          data: {
            ticketId: ticket.id,
            eventId: ticket.eventId,
            status: decision,
            reason: decision === "ALREADY_USED" ? "Ingresso ja utilizado." : "Ingresso invalido.",
            deviceName: deviceName || null
          }
        });

        return {
          status: decision,
          message:
            decision === "ALREADY_USED"
              ? "Ingresso ja utilizado."
              : decision === "CANCELED"
                ? "Ingresso cancelado."
                : "Ingresso invalido.",
          ticket: {
            code: ticket.code,
            eventTitle: ticket.event.title,
            lotName: ticket.lot.name,
            buyerName: ticket.order.customer.name,
            checkedAt: ticket.usedAt || undefined
          }
        };
      }

      const usedAt = new Date();
      const updated = await tx.ticket.updateMany({
        where: {
          id: ticket.id,
          status: "ACTIVE"
        },
        data: {
          status: "USED",
          usedAt
        }
      });

      if (updated.count !== 1) {
        await tx.checkIn.create({
          data: {
            ticketId: ticket.id,
            eventId: ticket.eventId,
            status: CheckInStatus.ALREADY_USED,
            reason: "Tentativa simultanea ou ingresso ja usado.",
            deviceName: deviceName || null
          }
        });

        return {
          status: CheckInStatus.ALREADY_USED,
          message: "Ingresso ja utilizado.",
          ticket: {
            code: ticket.code,
            eventTitle: ticket.event.title,
            lotName: ticket.lot.name,
            buyerName: ticket.order.customer.name,
            checkedAt: ticket.usedAt || undefined
          }
        };
      }

      await tx.checkIn.create({
        data: {
          ticketId: ticket.id,
          eventId: ticket.eventId,
          status: CheckInStatus.APPROVED,
          deviceName: deviceName || null,
          checkedAt: usedAt
        }
      });

      return {
        status: CheckInStatus.APPROVED,
        message: "Entrada liberada.",
        ticket: {
          code: ticket.code,
          eventTitle: ticket.event.title,
          lotName: ticket.lot.name,
          buyerName: ticket.order.customer.name,
          checkedAt: usedAt
        }
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000
    }
  );
}

export async function listRecentCheckIns() {
  return prisma.checkIn.findMany({
    orderBy: {
      checkedAt: "desc"
    },
    take: 20,
    include: {
      ticket: {
        include: {
          lot: true,
          order: {
            include: {
              customer: true
            }
          }
        }
      },
      event: true
    }
  });
}

export async function getCheckInStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [approvedToday, blockedToday, totalToday] = await Promise.all([
    prisma.checkIn.count({
      where: {
        status: CheckInStatus.APPROVED,
        checkedAt: {
          gte: startOfDay
        }
      }
    }),
    prisma.checkIn.count({
      where: {
        status: {
          in: [CheckInStatus.ALREADY_USED, CheckInStatus.INVALID, CheckInStatus.CANCELED]
        },
        checkedAt: {
          gte: startOfDay
        }
      }
    }),
    prisma.checkIn.count({
      where: {
        checkedAt: {
          gte: startOfDay
        }
      }
    })
  ]);

  return {
    approvedToday,
    blockedToday,
    totalToday
  };
}
