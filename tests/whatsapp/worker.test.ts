import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: {} as any,
  graph: vi.fn(),
  config: vi.fn(),
  sync: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/features/whatsapp/campaigns/meta", async () => {
  const actual = await vi.importActual<any>(
    "@/features/whatsapp/campaigns/meta",
  );
  return {
    ...actual,
    graph: mocks.graph,
    integrationConfig: mocks.config,
    syncIntegration: mocks.sync,
    uploadMetaMedia: mocks.upload,
  };
});
import {
  processOne,
  claimJob,
  recoverTemporaryPause,
} from "@/features/whatsapp/campaigns/worker";
import { configSchema } from "@/features/whatsapp/campaigns/rules";
import { MetaRequestError } from "@/features/whatsapp/campaigns/meta";
let campaign: any, job: any, contact: any, integration: any, gates: any[];
function patch(row: any, data: any) {
  for (const [key, value] of Object.entries(data))
    row[key] =
      value && typeof value === "object" && "increment" in value
        ? (row[key] ?? 0) + (value as any).increment
        : value;
  return { ...row };
}
beforeEach(() => {
  vi.clearAllMocks();
  const now = new Date();
  const config = configSchema.parse({
    name: "Teste",
    templateId: "template",
    message: "Olá",
  });
  const template = {
    id: "template",
    name: "convite",
    language: "pt_BR",
    status: "APPROVED",
    category: "MARKETING",
    components: [{ type: "BODY", text: "Olá" }],
  };
  campaign = {
    id: "campaign",
    organizationId: "org",
    status: "queued",
    config,
    snapshot: { config, template },
    nextDispatchAt: now,
    dispatchedCount: 0,
    startedAt: null,
  };
  contact = {
    id: "contact",
    phone: "+5511987654321",
    name: "Lucas",
    optInStatus: "opt_in",
    optInDate: now,
    optInSource: "form",
    purpose: "marketing",
    cooldownUntil: null,
    lastMarketingAt: null,
    lastReservedAt: null,
    lastInboundAt: null,
    unengagedCount: 0,
    status: "active",
  };
  job = {
    id: "job",
    campaignId: "campaign",
    organizationId: "org",
    contactId: "contact",
    phone: contact.phone,
    recipient: { name: "Lucas" },
    state: "queued",
    attempts: 0,
    reservedAt: null,
    providerMessageId: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    acceptedAt: null,
    uncertain: false,
    clickToken: "click",
  };
  integration = {
    id: "integration",
    organizationId: "org",
    phoneNumberId: "phone",
    wabaId: "waba",
    portfolioId: null,
    syncedAt: now,
    blockedReason: null,
    minimumIntervalMs: 1000,
    frequencyHours: 72,
    disengagedAfter: 3,
    cooldownDays: 14,
    consecutiveErrors: 0,
  };
  gates = [];
  Object.assign(mocks.db, {
    $transaction: vi.fn(async (fn: any) => fn(mocks.db)),
    $queryRaw: vi.fn(async () => []),
    waCampaign: {
      findMany: vi.fn(async () => [campaign]),
      findUniqueOrThrow: vi.fn(async () => ({ ...campaign })),
      update: vi.fn(async ({ data }: any) => patch(campaign, data)),
      updateMany: vi.fn(async ({ data }: any) => {
        patch(campaign, data);
        return { count: 1 };
      }),
    },
    waIntegration: {
      findUnique: vi.fn(async () => ({ ...integration })),
      findUniqueOrThrow: vi.fn(async () => ({ ...integration })),
      update: vi.fn(async ({ data }: any) => patch(integration, data)),
    },
    waRateGate: {
      upsert: vi.fn(async ({ where, create }: any) => {
        if (!gates.find((g) => g.key === where.key)) gates.push({ ...create });
      }),
      findMany: vi.fn(async () => gates),
      updateMany: vi.fn(async ({ data }: any) => {
        gates.forEach((g) => patch(g, data));
      }),
    },
    waMessageJob: {
      findFirst: vi.fn(async () =>
        ["queued", "deferred"].includes(job.state) && !job.uncertain
          ? { ...job, contact: { ...contact } }
          : null,
      ),
      findUniqueOrThrow: vi.fn(async () => ({ ...job })),
      update: vi.fn(async ({ data }: any) => patch(job, data)),
      updateMany: vi.fn(async ({ data }: any) => {
        patch(job, data);
        return { count: 1 };
      }),
      count: vi.fn(async () =>
        ["queued", "deferred", "sending"].includes(job.state) ? 1 : 0,
      ),
    },
    waContact: {
      findUniqueOrThrow: vi.fn(async () => ({ ...contact })),
      update: vi.fn(async ({ data }: any) => patch(contact, data)),
    },
    waSuppression: { findUnique: vi.fn(async () => null) },
    event: { findFirst: vi.fn(async () => null) },
    waTemplate: { findUnique: vi.fn(async () => template) },
    waAudit: { create: vi.fn(async () => ({})) },
  });
  mocks.config.mockResolvedValue({ phone: "phone", waba: "waba" });
  mocks.graph.mockResolvedValue({ messages: [{ id: "wamid.1" }] });
});
describe("durable WhatsApp worker", () => {
  it("records API acceptance separately and never reclaims the accepted message", async () => {
    await processOne();
    expect(mocks.graph).toHaveBeenCalledTimes(1);
    expect(job.acceptedAt).toBeInstanceOf(Date);
    expect(job.sentAt).toBeNull();
    expect(job.deliveredAt).toBeNull();
    expect(job.providerMessageId).toBe("wamid.1");
    gates.forEach((g) => (g.nextAt = new Date(0)));
    await processOne();
    expect(mocks.graph).toHaveBeenCalledTimes(1);
  });
  it("quarantines a timeout and never retries an uncertain submission", async () => {
    mocks.graph.mockRejectedValue(new MetaRequestError(0, 0, "timeout", true));
    await processOne();
    expect(job.state).toBe("deferred");
    expect(job.uncertain).toBe(true);
    expect(campaign.status).toBe("paused");
    integration.blockedReason = null;
    campaign.status = "queued";
    gates.forEach((g) => (g.nextAt = new Date(0)));
    await processOne();
    expect(mocks.graph).toHaveBeenCalledTimes(1);
  });
  it("uses shared WABA and phone gates across campaigns", async () => {
    const first = await claimJob();
    expect(first?.id).toBe("job");
    job = { ...job, id: "job2", state: "queued", reservedAt: null };
    campaign.id = "campaign2";
    expect(await claimJob()).toBeNull();
    expect(gates.map((g) => g.key)).toEqual(["phone:phone", "waba:waba"]);
  });
  it("suppresses the contact before any provider call", async () => {
    mocks.db.waSuppression.findUnique.mockResolvedValue({
      phone: contact.phone,
    });
    await processOne();
    expect(mocks.graph).not.toHaveBeenCalled();
    expect(job.state).toBe("cancelled");
  });
  it("backs off explicit rate limits and opens the circuit", async () => {
    mocks.graph.mockRejectedValue(
      new MetaRequestError(130429, 400, "Rate limit"),
    );
    await processOne();
    expect(job.state).toBe("deferred");
    expect(job.uncertain).toBe(false);
    expect(integration.minimumIntervalMs).toBe(2000);
    expect(integration.blockedUntil).toBeInstanceOf(Date);
    expect(campaign.status).toBe("paused");
  });
});

describe("temporary circuit recovery", () => {
  it("revalidates health before resuming a timed pause", async () => {
    integration.blockedReason = "Rate limit";
    integration.blockedUntil = new Date(0);
    campaign.status = "paused";
    campaign.pauseReason = "Rate limit";
    mocks.sync.mockResolvedValue({
      ...integration,
      health: { quality_rating: "GREEN", status: "CONNECTED" },
    });
    mocks.db.waMessageJob.count.mockResolvedValue(0);
    await recoverTemporaryPause("org");
    expect(mocks.sync).toHaveBeenCalledWith("org", "worker");
    expect(integration.blockedReason).toBeNull();
    expect(campaign.status).toBe("queued");
    expect(mocks.db.waCampaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org",
          status: "paused",
          pauseReason: "Rate limit",
        },
      }),
    );
  });
  it("never resumes while any message outcome is uncertain", async () => {
    integration.blockedReason = "Rate limit";
    integration.blockedUntil = new Date(0);
    campaign.status = "paused";
    mocks.sync.mockResolvedValue({
      ...integration,
      health: { quality_rating: "GREEN" },
    });
    mocks.db.waMessageJob.count.mockResolvedValue(1);
    await recoverTemporaryPause("org");
    expect(integration.blockedReason).toBe("Rate limit");
    expect(campaign.status).toBe("paused");
  });
});

it("keeps shared gates reserved while the provider request is in flight", async () => {
  mocks.graph.mockImplementation(async () => {
    expect(gates.every((g) => g.nextAt.getTime() > Date.now() + 60000)).toBe(
      true,
    );
    return { messages: [{ id: "wamid.lease" }] };
  });
  await processOne();
  expect(gates.every((g) => g.nextAt.getTime() < Date.now() + 3000)).toBe(true);
  expect(mocks.db.waRateGate.updateMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ nextAt: expect.any(Date) }),
    }),
  );
});
