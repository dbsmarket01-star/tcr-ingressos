"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type OrderStatusWatcherProps = {
  code: string;
  initialStatus: string;
  initialPaymentStatus?: string | null;
};

const FINAL_STATUSES = new Set(["PAID", "CANCELED", "EXPIRED", "REFUNDED"]);

export function OrderStatusWatcher({
  code,
  initialStatus,
  initialPaymentStatus
}: OrderStatusWatcherProps) {
  const router = useRouter();
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (FINAL_STATUSES.has(initialStatus) || initialPaymentStatus === "APPROVED") {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${code}/status`, {
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          status?: string;
          paymentStatus?: string | null;
        };

        if (
          !refreshedRef.current &&
          (FINAL_STATUSES.has(data.status || initialStatus) || data.paymentStatus === "APPROVED")
        ) {
          refreshedRef.current = true;
          router.refresh();
        }
      } catch {
        // Falhas transitórias de rede não devem quebrar a tela nem impedir a próxima checagem.
      }
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [code, initialPaymentStatus, initialStatus, router]);

  return null;
}
