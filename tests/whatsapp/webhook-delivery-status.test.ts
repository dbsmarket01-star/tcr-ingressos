import { WhatsAppMessageStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const message = vi.hoisted(() => ({
  row: null as null | {
    id: string;
    status: WhatsAppMessageStatus;
    errorMessage: string | null;
    failedAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
  },
  created: 0
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    whatsAppMessageLog: {
      updateMany: vi.fn(async ({ where, data }) => {
        if (!message.row || !where.status.in.includes(message.row.status)) return { count: 0 };
        Object.assign(message.row, data);
        return { count: 1 };
      }),
      findFirst: vi.fn(async () => message.row ? { id: message.row.id } : null),
      create: vi.fn(async ({ data }) => {
        message.created += 1;
        message.row = {
          id: "test-log",
          status: data.status,
          errorMessage: data.errorMessage,
          failedAt: data.failedAt,
          deliveredAt: data.deliveredAt,
          readAt: data.readAt
        };
        return message.row;
      })
    }
  }
}));

import { handleWhatsAppMetaWebhook } from "@/features/whatsapp/whatsapp.service";

function event(status: string, timestamp: string) {
  return {
    entry: [{ changes: [{ value: { statuses: [{
      id: "wamid.test",
      recipient_id: "5511999999999",
      status,
      timestamp,
      ...(status === "failed" ? { errors: [{ code: 131026, message: "Message undeliverable" }] } : {})
    }] } }] }]
  };
}

beforeEach(() => {
  message.row = {
    id: "test-log",
    status: WhatsAppMessageStatus.SENT,
    errorMessage: null,
    failedAt: null,
    deliveredAt: null,
    readAt: null
  };
  message.created = 0;
});

describe("WhatsApp delivery status webhooks", () => {
  it("clears a stale failure when Meta subsequently confirms delivery and reading", async () => {
    await handleWhatsAppMetaWebhook(event("failed", "1792620085"));
    expect(message.row?.status).toBe(WhatsAppMessageStatus.FAILED);
    expect(message.row?.errorMessage).toBe("Message undeliverable");

    await handleWhatsAppMetaWebhook(event("delivered", "1792620086"));
    expect(message.row?.status).toBe(WhatsAppMessageStatus.DELIVERED);
    expect(message.row?.errorMessage).toBeNull();
    expect(message.row?.failedAt).toBeNull();

    await handleWhatsAppMetaWebhook(event("read", "1792620095"));
    expect(message.row?.status).toBe(WhatsAppMessageStatus.READ);
    expect(message.row?.readAt).toBeInstanceOf(Date);
  });

  it("ignores late failure and delivery events after a read without duplicating logs", async () => {
    await handleWhatsAppMetaWebhook(event("read", "1792620095"));
    await handleWhatsAppMetaWebhook(event("failed", "1792620085"));
    await handleWhatsAppMetaWebhook(event("delivered", "1792620086"));
    expect(message.row?.status).toBe(WhatsAppMessageStatus.READ);
    expect(message.row?.errorMessage).toBeNull();
    expect(message.created).toBe(0);
  });

  it("keeps a genuine failure visible when no delivery arrives", async () => {
    await handleWhatsAppMetaWebhook(event("failed", "1792620085"));
    await handleWhatsAppMetaWebhook(event("sent", "1792620080"));
    expect(message.row?.status).toBe(WhatsAppMessageStatus.FAILED);
    expect(message.row?.errorMessage).toBe("Message undeliverable");
    expect(message.created).toBe(0);
  });
});
