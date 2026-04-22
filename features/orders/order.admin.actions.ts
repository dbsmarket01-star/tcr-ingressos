"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/features/audit/audit.service";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { cancelPendingOrderByCode, expirePendingOrders, refundPaidOrderByCode } from "./order.service";

export async function expirePendingOrdersAction() {
  const admin = await requirePermission("ORDERS");
  const result = await expirePendingOrders({ limit: 200, allowedEventIds: getAdminAllowedEventIds(admin) });
  const params = new URLSearchParams({
    expired: String(result.expiredCount),
    released: String(result.releasedQuantity)
  });

  revalidatePath("/admin/orders");
  revalidatePath("/admin/events");
  revalidatePath("/admin/finance");

  redirect(`/admin/orders?${params.toString()}`);
}

export async function cancelPendingOrderAction(formData: FormData) {
  const admin = await requirePermission("ORDERS");
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!orderCode) {
    throw new Error("Pedido nao informado.");
  }

  try {
    const result = await cancelPendingOrderByCode(orderCode, undefined, allowedEventIds);

    await createAuditLog({
      adminUserId: admin.id,
      action: "ORDER_CANCELED_MANUALLY",
      entityType: "Order",
      entityId: orderCode,
      metadata: {
        releasedQuantity: result.releasedQuantity
      }
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/events");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");

    redirect(`/admin/orders?canceled=${encodeURIComponent(orderCode)}&released=${result.releasedQuantity}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel cancelar o pedido.";
    redirect(`/admin/orders?orderError=${encodeURIComponent(message)}`);
  }
}

export async function refundPaidOrderAction(formData: FormData) {
  const admin = await requirePermission("ORDERS");
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const orderCode = String(formData.get("orderCode") ?? "").trim();
  const refundReason =
    String(formData.get("refundReason") ?? "").trim() || "Reembolso registrado manualmente pela operacao.";

  if (!orderCode) {
    throw new Error("Pedido nao informado.");
  }

  try {
    const result = await refundPaidOrderByCode(orderCode, refundReason, allowedEventIds);

    await createAuditLog({
      adminUserId: admin.id,
      action: "ORDER_REFUNDED_MANUALLY",
      entityType: "Order",
      entityId: orderCode,
      metadata: {
        releasedQuantity: result.releasedQuantity,
        canceledTickets: result.canceledTickets,
        refundReason
      }
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderCode}`);
    revalidatePath("/admin/events");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/tickets");
    revalidatePath("/admin/audit");
    if (result.eventSlug) {
      revalidatePath(`/evento/${result.eventSlug}`);
    }

    redirect(
      `/admin/orders/${orderCode}?refunded=1&released=${result.releasedQuantity}&ticketsCanceled=${result.canceledTickets}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel registrar o reembolso.";
    redirect(`/admin/orders/${orderCode}?orderError=${encodeURIComponent(message)}`);
  }
}
