import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  order: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  ticket: {
    groupBy: vi.fn()
  },
  checkIn: {
    groupBy: vi.fn(),
    findMany: vi.fn()
  },
  event: {
    findMany: vi.fn()
  },
  eventLead: {
    findMany: vi.fn()
  },
  eventPageVisit: {
    count: vi.fn()
  }
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

function mockEmptyDashboardQueries() {
  prismaMock.order.findMany.mockResolvedValue([]);
  prismaMock.order.count.mockResolvedValue(0);
  prismaMock.ticket.groupBy.mockResolvedValue([]);
  prismaMock.checkIn.groupBy.mockResolvedValue([]);
  prismaMock.checkIn.findMany.mockResolvedValue([]);
  prismaMock.event.findMany.mockResolvedValue([]);
  prismaMock.eventLead.findMany.mockResolvedValue([]);
  prismaMock.eventPageVisit.count.mockResolvedValue(0);
}

describe("dashboard tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmptyDashboardQueries();
  });

  it("always scopes dashboard metrics to the current organization", async () => {
    const { getDashboardMetrics } = await import("@/features/dashboard/dashboard.service");

    await getDashboardMetrics({}, "org_a2", null);

    const eventScope = {
      organizationId: "org_a2",
      status: {
        not: "DRAFT"
      }
    };

    expect(prismaMock.order.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          event: eventScope
        })
      })
    );
    expect(prismaMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: eventScope
      })
    );
    expect(prismaMock.eventLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event: eventScope
        })
      })
    );
    expect(prismaMock.eventPageVisit.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event: eventScope
        })
      })
    );
  });

  it("keeps per-user event restrictions inside the organization scope", async () => {
    const { getDashboardMetrics } = await import("@/features/dashboard/dashboard.service");

    await getDashboardMetrics({}, "org_a2", ["event_a2"]);

    expect(prismaMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_a2",
          status: {
            not: "DRAFT"
          },
          id: {
            in: ["event_a2"]
          }
        }
      })
    );
  });
});
