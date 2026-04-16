"use client";

import { useEffect, useMemo, useState } from "react";

type OrderCountdownProps = {
  expiresAt: string;
};

function formatTime(ms: number) {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function OrderCountdown({ expiresAt }: OrderCountdownProps) {
  const expiresAtMs = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    setRemainingMs(expiresAtMs - Date.now());

    const interval = window.setInterval(() => {
      setRemainingMs(expiresAtMs - Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [expiresAtMs]);

  const expired = remainingMs !== null && remainingMs <= 0;

  return (
    <div className={`orderCountdown ${expired ? "expired" : ""}`}>
      <span>{expired ? "Reserva vencida" : "Tempo para pagamento"}</span>
      <strong>{remainingMs === null ? "--:--" : expired ? "00:00" : formatTime(remainingMs)}</strong>
      <p>
        {expired
          ? "Atualize a pagina para confirmar a expiracao e liberar o estoque."
          : "Depois desse prazo, os ingressos voltam automaticamente para o estoque."}
      </p>
    </div>
  );
}
