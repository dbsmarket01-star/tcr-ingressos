import { HomeListStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type HomeListFilters = {
  eventId?: string | null;
  hotelId?: string | null;
  status?: HomeListStatus | null;
  search?: string | null;
};

export type HomeListUpdateInput = {
  status: HomeListStatus;
  roomNumber?: string | null;
  guest1Name: string;
  guest1Document: string;
  guest1BirthDate: Date;
  guest1Email: string;
  guest1Phone: string;
  guest2Name: string;
  guest2Document: string;
  guest2BirthDate: Date;
};

export async function createHomeListEntriesForApprovedOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  paidAt: Date
) {
  const orderDelegate = (tx as unknown as { order?: { findUnique?: Prisma.TransactionClient["order"]["findUnique"] } }).order;

  if (typeof orderDelegate?.findUnique !== "function") {
    return 0;
  }

  const order = await orderDelegate.findUnique({
    where: {
      id: orderId
    },
    select: {
      id: true,
      eventId: true,
      paidAt: true,
      createdAt: true,
      event: {
        select: {
          organizationId: true
        }
      },
      orderHotelGuests: {
        include: {
          homeListEntry: {
            select: {
              id: true
            }
          }
        }
      }
    }
  });

  if (!order || order.orderHotelGuests.length === 0) {
    return 0;
  }

  let created = 0;
  const purchaseDate = order.paidAt ?? paidAt ?? order.createdAt;

  for (const guest of order.orderHotelGuests) {
    if (guest.homeListEntry) {
      continue;
    }

    await tx.homeListEntry.create({
      data: {
        organizationId: order.event.organizationId,
        eventId: order.eventId,
        hotelId: guest.hotelId,
        orderId: order.id,
        orderItemId: guest.orderItemId,
        lotId: guest.lotId,
        orderHotelGuestId: guest.id,
        status: HomeListStatus.CONFIRMED,
        purchaseDate,
        confirmedAt: paidAt,
        guest1Name: guest.guest1Name,
        guest1Document: guest.guest1Document,
        guest1BirthDate: guest.guest1BirthDate,
        guest1Email: guest.guest1Email,
        guest1Phone: guest.guest1Phone,
        guest2Name: guest.guest2Name,
        guest2Document: guest.guest2Document,
        guest2BirthDate: guest.guest2BirthDate
      }
    });
    created += 1;
  }

  return created;
}

export async function updateHomeListStatusForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  status: HomeListStatus
) {
  const now = new Date();

  return tx.homeListEntry.updateMany({
    where: {
      orderId
    },
    data: {
      status,
      canceledAt: status === HomeListStatus.CANCELED ? now : null,
      confirmedAt: status === HomeListStatus.CONFIRMED ? now : undefined
    }
  });
}

function buildHomeListWhere(
  organizationId: string,
  filters: HomeListFilters,
  allowedEventIds?: string[] | null
): Prisma.HomeListEntryWhereInput {
  const search = String(filters.search ?? "").trim();
  const eventId =
    filters.eventId && allowedEventIds && !allowedEventIds.includes(filters.eventId)
      ? "__blocked__"
      : filters.eventId;

  return {
    organizationId,
    ...(eventId ? { eventId } : allowedEventIds ? { eventId: { in: allowedEventIds } } : {}),
    ...(filters.hotelId ? { hotelId: filters.hotelId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(search
      ? {
          OR: [
            { guest1Name: { contains: search, mode: "insensitive" } },
            { guest1Document: { contains: search, mode: "insensitive" } },
            { guest2Name: { contains: search, mode: "insensitive" } },
            { guest2Document: { contains: search, mode: "insensitive" } },
            { order: { code: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {})
  };
}

export async function listHomeListEntries(
  organizationId: string,
  filters: HomeListFilters,
  allowedEventIds?: string[] | null
) {
  return prisma.homeListEntry.findMany({
    where: buildHomeListWhere(organizationId, filters, allowedEventIds),
    orderBy: [
      {
        purchaseDate: "desc"
      },
      {
        createdAt: "desc"
      }
    ],
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startsAt: true
        }
      },
      hotel: {
        select: {
          id: true,
          name: true,
          city: true,
          state: true
        }
      },
      order: {
        select: {
          code: true,
          createdAt: true
        }
      },
      lot: {
        select: {
          name: true
        }
      }
    }
  });
}

export async function getHomeListFilterOptions(organizationId: string, allowedEventIds?: string[] | null) {
  const [events, hotels] = await Promise.all([
    prisma.event.findMany({
      where: {
        organizationId,
        ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
      },
      orderBy: {
        startsAt: "desc"
      },
      select: {
        id: true,
        title: true
      }
    }),
    prisma.hotel.findMany({
      where: {
        organizationId
      },
      orderBy: {
        name: "asc"
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true
      }
    })
  ]);

  return { events, hotels };
}

export async function updateHomeListEntry(
  entryId: string,
  organizationId: string,
  input: HomeListUpdateInput,
  allowedEventIds?: string[] | null
) {
  const entry = await prisma.homeListEntry.findFirst({
    where: {
      id: entryId,
      organizationId,
      ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {})
    },
    select: {
      id: true
    }
  });

  if (!entry) {
    throw new Error("Registro da HOME LIST nao encontrado.");
  }

  return prisma.homeListEntry.update({
    where: {
      id: entry.id
    },
    data: {
      status: input.status,
      roomNumber: input.roomNumber || null,
      canceledAt: input.status === HomeListStatus.CANCELED ? new Date() : null,
      confirmedAt: input.status === HomeListStatus.CONFIRMED ? new Date() : undefined,
      guest1Name: input.guest1Name,
      guest1Document: input.guest1Document,
      guest1BirthDate: input.guest1BirthDate,
      guest1Email: input.guest1Email,
      guest1Phone: input.guest1Phone,
      guest2Name: input.guest2Name,
      guest2Document: input.guest2Document,
      guest2BirthDate: input.guest2BirthDate
    }
  });
}

export async function listHomeListEntriesForExport(
  organizationId: string,
  filters: HomeListFilters,
  allowedEventIds?: string[] | null
) {
  return listHomeListEntries(organizationId, filters, allowedEventIds);
}
