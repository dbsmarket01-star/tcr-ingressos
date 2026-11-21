"use client";

import { useEffect } from "react";

const storageKey = "tcr-event-create-draft";

type SavedField = { value: string; checked?: boolean };

export function EventCreateDraftPersistence({ restoreAfterError }: { restoreAfterError: boolean }) {
  useEffect(() => {
    const form = document.getElementById("event-create-form") as HTMLFormElement | null;
    if (!form) return;

    if (restoreAfterError) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "{}") as Record<string, SavedField>;
        for (const control of Array.from(form.elements)) {
          if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) continue;
          if (!control.name || control instanceof HTMLInputElement && ["file", "password", "hidden"].includes(control.type)) continue;
          const value = saved[control.name];
          if (!value) continue;
          if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
            control.checked = Boolean(value.checked);
          } else {
            control.value = value.value;
          }
        }
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    } else {
      sessionStorage.removeItem(storageKey);
    }

    const save = () => {
      const values: Record<string, SavedField> = {};
      for (const control of Array.from(form.elements)) {
        if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) continue;
        if (!control.name || control instanceof HTMLInputElement && ["file", "password", "hidden"].includes(control.type)) continue;
        values[control.name] = {
          value: control.value,
          ...(control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")
            ? { checked: control.checked }
            : {})
        };
      }
      try { sessionStorage.setItem(storageKey, JSON.stringify(values)); } catch { /* storage may be unavailable */ }
    };

    form.addEventListener("input", save);
    form.addEventListener("change", save);
    form.addEventListener("submit", save);
    return () => {
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
      form.removeEventListener("submit", save);
    };
  }, [restoreAfterError]);

  return null;
}
