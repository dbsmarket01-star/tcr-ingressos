"use client";

import { useEffect } from "react";

/** Revalidate authentication when a browser restores an old page from its history cache. */
export function AdminSessionRestoreGuard() {
  useEffect(() => {
    const onRestore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onRestore);
    return () => window.removeEventListener("pageshow", onRestore);
  }, []);
  return null;
}
