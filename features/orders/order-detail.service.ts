import { prisma } from "@/lib/prisma";
import { summarizeAsaasSplit } from "@/features/payments/split-report.service";

export async function getAdminOrderDetail(code: string) {
  const order = await prisma.order.findUnique({
    where: {
      code
    },
    include: {
      customer: true,
      event: true,
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
