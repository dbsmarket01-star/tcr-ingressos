"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/features/audit/audit.service";
import { requirePermission } from "@/features/auth/auth.service";
import { cancelPendingOrderByCode, expirePendingOrders } from "./order.service";

export async function expirePendingOrdersAction() {
  await requirePermission("ORDERS");
  const result = await expirePendingOrders({ limit: 200 });
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
  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!orderCode) {
    throw new Error("Pedido nao informado.");
  }

  try {
    const result = await cancelPendingOrderByCode(orderCode);

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
