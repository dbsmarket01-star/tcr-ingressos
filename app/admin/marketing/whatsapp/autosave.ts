"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  initialConfig,
  type CampaignConfig,
} from "@/features/whatsapp/campaigns/rules";
export async function api(body: unknown) {
  const response = await fetch("/api/admin/whatsapp/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: false,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(
      data.error ?? "Não foi possível salvar.",
    ) as Error & { conflict?: boolean };
    error.conflict = data.conflict;
    throw error;
  }
  return data.result;
}
export function useCampaignDraft(id?: string) {
  const [config, setConfig] = useState<CampaignConfig>(initialConfig),
    [saveState, setSaveState] = useState(""),
    [conflict, setConflict] = useState(false),
    [version, setVersion] = useState(0);
  const refs = useRef({
    config: initialConfig,
    version: 0,
    dirty: false,
    blocked: false,
    generation: 0,
  });
  const inFlight = useRef<Promise<boolean> | null>(null);
  const [tick, setTick] = useState(0);
  const backup = useCallback(() => {
    if (id)
      try {
        localStorage.setItem(
          `wa-draft:${id}`,
          JSON.stringify({
            config: refs.current.config,
            baseVersion: refs.current.version,
            at: Date.now(),
          }),
        );
      } catch {}
  }, [id]);
  const initialize = useCallback(
    (raw: CampaignConfig, v: number) => {
      let restored: CampaignConfig | null = null;
      let blocked = false;
      try {
        const local = JSON.parse(
          localStorage.getItem(`wa-draft:${id}`) ?? "null",
        );
        if (local) {
          if (local.baseVersion === v) restored = local.config;
          else if (JSON.stringify(local.config) !== JSON.stringify(raw))
            blocked = true;
        }
      } catch {}
      refs.current = {
        config: restored ?? raw,
        version: v,
        dirty: !!restored,
        blocked,
        generation: 0,
      };
      setConfig(refs.current.config);
      setVersion(v);
      setConflict(blocked);
      setSaveState(
        blocked
          ? "Conflito entre abas — escolha a versão atual"
          : restored
            ? "Recuperando alterações locais..."
            : "Salvo automaticamente",
      );
      setTick((n) => n + 1);
    },
    [id],
  );
  const update = useCallback(
    (changes: Partial<CampaignConfig>) => {
      refs.current.config = { ...refs.current.config, ...changes };
      refs.current.dirty = true;
      refs.current.generation++;
      setConfig(refs.current.config);
      backup();
      setTick((n) => n + 1);
    },
    [backup],
  );
  const flush = useCallback(async (): Promise<boolean> => {
    if (!id || !refs.current.version || refs.current.blocked) return false;
    if (inFlight.current) {
      await inFlight.current;
      if (refs.current.dirty && !refs.current.blocked) return flush();
      return !refs.current.blocked;
    }
    if (!refs.current.dirty) return true;
    const generation = refs.current.generation;
    setSaveState("Salvando...");
    const work = (async () => {
      try {
        const result = await api({
          operation: "save",
          id,
          version: refs.current.version,
          config: refs.current.config,
        });
        refs.current.version = result.version;
        setVersion(result.version);
        refs.current.dirty = refs.current.generation !== generation;
        if (refs.current.dirty) backup();
        else localStorage.removeItem(`wa-draft:${id}`);
        setSaveState(
          `Salvo automaticamente às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        );
        return true;
      } catch (e) {
        const conflict = Boolean((e as any).conflict);
        refs.current.blocked = conflict;
        setConflict(conflict);
        setSaveState(
          conflict
            ? (e as Error).message
            : "Erro ao salvar — tentando novamente",
        );
        return false;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = work;
    return work;
  }, [id, backup]);
  useEffect(() => {
    if (!id) return;
    const timer = setTimeout(() => {
      if (refs.current.dirty && !refs.current.blocked)
        void flush().then((ok) => {
          if (!ok && !refs.current.blocked)
            setTimeout(() => setTick((n) => n + 1), 2000);
        });
    }, 750);
    return () => clearTimeout(timer);
  }, [id, tick, flush]);
  useEffect(() => {
    const leave = () => {
      if (refs.current.dirty) {
        backup();
        void flush();
      }
    };
    window.addEventListener("pagehide", leave);
    const visibility = () => {
      if (document.visibilityState === "hidden") leave();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [backup, flush]);
  return {
    config,
    update,
    initialize,
    flush,
    saveState,
    conflict,
    version,
    versionRef: refs,
  };
}
