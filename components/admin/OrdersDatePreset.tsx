"use client";

import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { startDate: string; endDate: string };

export function OrdersDatePreset({ startDate, endDate, ...props }: Props) {
  return <button {...props} type="button" onClick={(event) => {
    const form = event.currentTarget.form;
    if (!form) return;
    const start = form.elements.namedItem("startDate");
    const end = form.elements.namedItem("endDate");
    if (!(start instanceof HTMLInputElement) || !(end instanceof HTMLInputElement)) return;
    start.value = startDate;
    end.value = endDate;
    // Submit the visible selections, not the previous server-rendered URL.
    form.requestSubmit();
  }} />;
}
