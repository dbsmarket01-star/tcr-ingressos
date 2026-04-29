"use client";

import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
    __turnstileScriptPromise?: Promise<void>;
  }
}

async function ensureTurnstileScript() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.turnstile) {
    return;
  }

  if (!window.__turnstileScriptPromise) {
    window.__turnstileScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');

      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Falha ao carregar Turnstile.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Falha ao carregar Turnstile."));
      document.head.appendChild(script);
    });
  }

  return window.__turnstileScriptPromise;
}

type TurnstileFieldProps = {
  siteKey?: string | null;
};

export function TurnstileField({ siteKey }: TurnstileFieldProps) {
  const containerId = useId().replace(/:/g, "");
  const widgetIdRef = useRef<string | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    let mounted = true;

    ensureTurnstileScript()
      .then(() => {
        if (!mounted || !window.turnstile || widgetIdRef.current) {
          return;
        }

        widgetIdRef.current = window.turnstile.render(`#${containerId}`, {
          sitekey: siteKey,
          theme: "light",
          callback: (token) => {
            if (hiddenInputRef.current) {
              hiddenInputRef.current.value = token;
            }
            setLoadError(null);
          },
          "expired-callback": () => {
            if (hiddenInputRef.current) {
              hiddenInputRef.current.value = "";
            }
          },
          "error-callback": () => {
            if (hiddenInputRef.current) {
              hiddenInputRef.current.value = "";
            }
            setLoadError("Não foi possível validar a proteção anti-bot. Atualize a página e tente novamente.");
          }
        });
      })
      .catch(() => {
        if (mounted) {
          setLoadError("Não foi possível carregar a proteção anti-bot. Atualize a página e tente novamente.");
        }
      });

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [containerId, siteKey]);

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    const resetWidget = () => {
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = "";
      }

      if (widgetIdRef.current && window.turnstile?.reset) {
        window.turnstile.reset(widgetIdRef.current);
      }
    };

    window.addEventListener("pageshow", resetWidget);

    return () => {
      window.removeEventListener("pageshow", resetWidget);
    };
  }, [siteKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className="turnstileField">
      <div className="turnstileWidget" id={containerId} />
      <input name="cf-turnstile-response" ref={hiddenInputRef} type="hidden" />
      {loadError ? <small className="errorText">{loadError}</small> : null}
    </div>
  );
}
