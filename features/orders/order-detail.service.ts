import { EventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { summarizeAsaasSplit } from "@/features/payments/split-report.service";

type EventScope = string[] | null | undefined;

export async function getAdminOrderDetail(code: string, organizationId: string, allowedEventIds?: EventScope) {
  const order = await prisma.order.findFirst({
    where: {
      code,
      event: {
        organizationId,
        status: {
          not: EventStatus.DRAFT
        }
      },
      ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {})
    },
    include: {
      customer: true,
      event: {
        include: {
          organization: {
            select: {
              name: true,
              publicDomain: true,
              adminDomain: true
            }
          }
        }
      },
      coupon: true,
      payment: true,
      items: {
        include: {
          lot: true,
          tickets: true
        }
      },
      tickets: {
        include: {
          lot: true,
          participant: true,
          checkIns: {
            orderBy: {
              checkedAt: "desc"
            },
            take: 5,
            include: {
              adminUser: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: {
          issuedAt: "asc"
        }
      }
    }
  });

  if (!order) {
    return null;
  }

  return {
    ...order,
    splitSummary: summarizeAsaasSplit(order.payment?.rawPayload)
  };
}
