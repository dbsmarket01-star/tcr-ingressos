import { AppUserStatus, PaymentGateway, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CreateAsaasSubscriptionInput = {
  userId: string;
  planId: string;
  customerDocument?: string | null;
  phone?: string | null;
};

type AsaasCustomerResponse = {
  id?: string;
  errors?: Array<{ description?: string }>;
};

type AsaasSubscriptionResponse = {
  id?: string;
  customer?: string;
  nextDueDate?: string;
  cycle?: string;
  value?: number;
  status?: string;
  externalReference?: string;
  errors?: Array<{ description?: string }>;
};

type AsaasWebhookPayload = {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    dueDate?: string;
  };
  subscription?: {
    id?: string;
  };
};

export type AsaasSubscriptionWebhookResult =
  | {
      handled: true;
      subscriptionId: string;
      status: SubscriptionStatus;
    }
  | {
      handled: false;
      reason: "missing_subscription_id" | "not_found";
    };

function calculatePeriodEndFromPlan(startDate: Date, durationDays: number) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + durationDays);
  return end;
}

function sanitizeDocument(value?: string | null) {
  return value?.replace(/\D/g, "") || undefined;
}

function sanitizePhone(value?: string | null) {
  return value?.replace(/\D/g, "") || undefined;
}

function asaasApiUrl() {
  return (process.env.ASAAS_API_URL || "https://api-sandbox.asaas.com/v3").replace(/\/$/, "");
}

function asaasApiKey() {
  const value = process.env.ASAAS_API_KEY;

  if (!value) {
    throw new Error("ASAAS_API_KEY nao configurado.");
  }

  return value;
}

async function asaasRequest<T>(path: string, init: RequestInit) {
  const response = await fetch(`${asaasApiUrl()}${path}`, {
    ...init,
    headers: {
      access_token: asaasApiKey(),
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const payload = (await response.json()) as T & { errors?: Array<{ description?: string }> };

  if (!response.ok) {
    const message = payload.errors?.map((item) => item.description).filter(Boolean).join(" ");
    throw new Error(message || "Falha ao comunicar com o Asaas.");
  }

  return payload;
}

function mapPlanIntervalToCycle(durationDays: number) {
  if (durationDays <= 31) {
    return "MONTHLY";
  }

  if (durationDays <= 92) {
    return "QUARTERLY";
  }

  if (durationDays <= 184) {
    return "SEMIANNUALLY";
  }

  return "YEARLY";
}

function mapAsaasSubscriptionStatus(status?: string, currentStatus?: SubscriptionStatus) {
  if (status === "ACTIVE") {
    return SubscriptionStatus.ACTIVE;
  }

  if (status === "INACTIVE") {
    return SubscriptionStatus.CANCELED;
  }

  if (status === "EXPIRED") {
    return SubscriptionStatus.EXPIRED;
  }

  return currentStatus || SubscriptionStatus.PENDING_PAYMENT;
}

function mapAppUserStatus(subscriptionStatus: SubscriptionStatus) {
  if (subscriptionStatus === SubscriptionStatus.ACTIVE) {
    return AppUserStatus.ACTIVE;
  }

  if (subscriptionStatus === SubscriptionStatus.PAST_DUE || subscriptionStatus === SubscriptionStatus.PENDING_PAYMENT) {
    return AppUserStatus.PAST_DUE;
  }

  if (subscriptionStatus === SubscriptionStatus.CANCELED || subscriptionStatus === SubscriptionStatus.EXPIRED) {
    return AppUserStatus.BLOCKED;
  }

  return AppUserStatus.TRIAL;
}

export async function createSubscriptionWithAsaas(input: CreateAsaasSubscriptionInput) {
  const user = await prisma.appUser.findUnique({
    where: { id: input.userId }
  });
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: input.planId }
  });

  if (!user || !plan) {
    throw new Error("Usuario ou plano nao encontrado.");
  }

  const externalReference = `sub_${user.id}_${plan.code}`;
  const customer = await asaasRequest<AsaasCustomerResponse>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      cpfCnpj: sanitizeDocument(input.customerDocument),
      mobilePhone: sanitizePhone(input.phone),
      externalReference: user.id,
      notificationDisabled: false
    })
  });

  if (!customer.id) {
    throw new Error("Asaas nao retornou o cliente.");
  }

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + plan.trialDays);

  const subscriptionResult = await asaasRequest<AsaasSubscriptionResponse>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id,
      billingType: "UNDEFINED",
      cycle: mapPlanIntervalToCycle(plan.durationDays),
      value: plan.priceInCents / 100,
      nextDueDate: nextDueDate.toISOString().slice(0, 10),
      description: `${plan.name} - Guerra à Pornografia`,
      externalReference
    })
  });

  if (!subscriptionResult.id) {
    throw new Error("Asaas nao retornou a assinatura.");
  }

  return prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      status: SubscriptionStatus.TRIALING,
      gateway: PaymentGateway.ASAAS,
      asaasCustomerId: customer.id,
      asaasSubscriptionId: subscriptionResult.id,
      externalReference,
      startedAt: new Date(),
      trialEndsAt: nextDueDate,
      currentPeriodStartsAt: new Date(),
      currentPeriodEndsAt: nextDueDate,
      nextBillingAt: nextDueDate
    }
  });
}

export async function syncSubscriptionAccess(subscriptionId: string, nextStatus: SubscriptionStatus, extra: Partial<{
  asaasPaymentId: string;
  currentPeriodEndsAt: Date;
  graceEndsAt: Date | null;
  lastPaymentAt: Date | null;
}> = {}) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      user: true
    }
  });

  if (!subscription) {
    throw new Error("Assinatura nao encontrada.");
  }

  const userStatus = mapAppUserStatus(nextStatus);

  return prisma.$transaction(async (tx) => {
    const updatedSubscription = await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: nextStatus,
        asaasPaymentId: extra.asaasPaymentId ?? subscription.asaasPaymentId,
        currentPeriodEndsAt: extra.currentPeriodEndsAt ?? subscription.currentPeriodEndsAt,
        graceEndsAt: extra.graceEndsAt === undefined ? subscription.graceEndsAt : extra.graceEndsAt,
        lastPaymentAt: extra.lastPaymentAt === undefined ? subscription.lastPaymentAt : extra.lastPaymentAt
      }
    });

    await tx.appUser.update({
      where: { id: subscription.userId },
      data: {
        status: userStatus,
        accessEndsAt: updatedSubscription.currentPeriodEndsAt ?? updatedSubscription.graceEndsAt ?? subscription.trialEndsAt
      }
    });

    return updatedSubscription;
  });
}

export async function handleAsaasSubscriptionWebhook(body: AsaasWebhookPayload) {
  const asaasSubscriptionId = body.subscription?.id;

  if (!asaasSubscriptionId) {
    console.warn("[asaas-subscription-webhook] Evento ignorado sem subscription.id.", {
      event: body.event,
      paymentId: body.payment?.id
    });

    return {
      handled: false,
      reason: "missing_subscription_id"
    } satisfies AsaasSubscriptionWebhookResult;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { asaasSubscriptionId },
    include: {
      plan: true
    }
  });

  if (!subscription) {
    console.warn("[asaas-subscription-webhook] Assinatura externa ignorada por nao existir localmente.", {
      asaasSubscriptionId,
      event: body.event,
      paymentId: body.payment?.id
    });

    return {
      handled: false,
      reason: "not_found"
    } satisfies AsaasSubscriptionWebhookResult;
  }

  const paymentStatus = body.payment?.status;
  const event = body.event;
  const amountInCents = body.payment?.value ? Math.round(body.payment.value * 100) : undefined;
  const dueDate = body.payment?.dueDate ? new Date(body.payment.dueDate) : undefined;

  let nextStatus = subscription.status;
  let graceEndsAt: Date | null | undefined;
  let lastPaymentAt: Date | null | undefined;
  let currentPeriodEndsAt: Date | undefined;

  if (
    event === "PAYMENT_RECEIVED" ||
    event === "PAYMENT_CONFIRMED" ||
    paymentStatus === "RECEIVED" ||
    paymentStatus === "CONFIRMED" ||
    paymentStatus === "RECEIVED_IN_CASH"
  ) {
    nextStatus = SubscriptionStatus.ACTIVE;
    lastPaymentAt = new Date();
    currentPeriodEndsAt = dueDate ? calculatePeriodEndFromPlan(dueDate, subscription.plan.durationDays) : undefined;
    graceEndsAt = null;
  } else if (event === "PAYMENT_OVERDUE" || paymentStatus === "OVERDUE") {
    nextStatus = SubscriptionStatus.PAST_DUE;
    const grace = new Date();
    grace.setDate(grace.getDate() + 2);
    graceEndsAt = grace;
  } else if (event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED" || paymentStatus === "REFUNDED") {
    nextStatus = SubscriptionStatus.CANCELED;
    graceEndsAt = null;
  } else if (event === "SUBSCRIPTION_DELETED") {
    nextStatus = SubscriptionStatus.CANCELED;
    graceEndsAt = null;
  } else if (event === "PAYMENT_RESTORED") {
    nextStatus = SubscriptionStatus.ACTIVE;
    graceEndsAt = null;
  } else if (event === "SUBSCRIPTION_UPDATED") {
    nextStatus = mapAsaasSubscriptionStatus(body.payment?.status, subscription.status);
  }

  await prisma.subscriptionPaymentEvent.create({
    data: {
      subscriptionId: subscription.id,
      gateway: PaymentGateway.ASAAS,
      gatewayPaymentId: body.payment?.id,
      gatewayEventId: event,
      gatewayStatus: paymentStatus || event || "UNKNOWN",
      amountInCents,
      paidAt: nextStatus === SubscriptionStatus.ACTIVE ? new Date() : null,
      dueDate,
      rawPayload: body
    }
  });

  await syncSubscriptionAccess(subscription.id, nextStatus, {
    asaasPaymentId: body.payment?.id,
    currentPeriodEndsAt,
    graceEndsAt,
    lastPaymentAt
  });

  return {
    handled: true,
    subscriptionId: subscription.id,
    status: nextStatus
  } satisfies AsaasSubscriptionWebhookResult;
}
