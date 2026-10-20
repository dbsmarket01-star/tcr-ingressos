"use client";

import { useEffect, useRef, useState } from "react";

const SOUND_STORAGE_KEY = "tcr-whatsapp-notification-sound";
const VOLUME_STORAGE_KEY = "tcr-whatsapp-notification-volume";
const FOREGROUND_POLL_MS = 1_000;
const BACKGROUND_POLL_MS = 5_000;
const DEFAULT_VOLUME = 85;

type NotificationSnapshot = {
  id: string;
  at: string;
  name: string;
  message: string;
  media: { kind: string; url: string | null; fileName: string | null; mimeType: string | null; caption: string | null } | null;
  phone: string | null;
};

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
  __tcrWhatsAppAudioContext?: AudioContext;
};

function BellIcon({ muted }: { muted: boolean }) {
  return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>
    {muted ? <path d="m4 4 16 16"/> : null}
  </svg>;
}

async function getUnlockedAudioContext() {
  const audioWindow = window as AudioWindow;
  const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioWindow.__tcrWhatsAppAudioContext || audioWindow.__tcrWhatsAppAudioContext.state === "closed") {
    audioWindow.__tcrWhatsAppAudioContext = new AudioContextClass();
  }
  const context = audioWindow.__tcrWhatsAppAudioContext;
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return null;
    }
  }
  return context.state === "running" ? context : null;
}

async function playNotificationSound(volume: number) {
  const context = await getUnlockedAudioContext();
  if (!context) return false;
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  master.gain.value = Math.max(0, Math.min(1, volume / 100)) * 0.65;
  master.connect(compressor);
  compressor.connect(context.destination);

  [784, 988, 1_175].forEach((frequency, index) => {
    const startsAt = context.currentTime + index * 0.32;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.9, startsAt + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.58);
    gain.connect(master);
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + 0.6);
  });
  window.setTimeout(() => {
    master.disconnect();
    compressor.disconnect();
  }, 1_450);
  return true;
}

export function WhatsAppNotificationWatcher({
  latestInboundId,
  latestInboundAt,
  unreadCount,
  refreshOnNewInbound
}: {
  latestInboundId: string | null;
  latestInboundAt: string | null;
  unreadCount: number;
  refreshOnNewInbound: boolean;
}) {
  const pollInFlight = useRef(false);
  const cursor = useRef({ at: latestInboundAt || new Date().toISOString(), id: latestInboundId || "0" });
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [liveUnreadCount, setLiveUnreadCount] = useState(unreadCount);

  useEffect(() => {
    const existingContext = (window as AudioWindow).__tcrWhatsAppAudioContext;
    setSoundEnabled(window.localStorage.getItem(SOUND_STORAGE_KEY) === "on" && existingContext?.state === "running");
    const storedVolumeValue = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    const storedVolume = storedVolumeValue === null ? NaN : Number(storedVolumeValue);
    if (Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 100) setVolume(storedVolume);
  }, []);

  useEffect(() => setLiveUnreadCount(unreadCount), [unreadCount]);

  useEffect(() => {
    const updateCount = (event: Event) => {
      const count = (event as CustomEvent<{ count: number }>).detail?.count;
      if (Number.isFinite(count)) setLiveUnreadCount(count);
    };
    window.addEventListener("tcr:whatsapp-unread-count", updateCount);
    return () => window.removeEventListener("tcr:whatsapp-unread-count", updateCount);
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    async function poll() {
      if (stopped || pollInFlight.current) return;
      pollInFlight.current = true;
      let hasMore = false;
      try {
        const query = new URLSearchParams({ afterAt: cursor.current.at, afterId: cursor.current.id });
        const response = await fetch(`/api/admin/crm/whatsapp/updates?${query}`, {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        if (!response.ok) return;
        const delta = (await response.json()) as { messages: NotificationSnapshot[]; hasMore: boolean };
        hasMore = delta.hasMore;
        for (const message of delta.messages) {
          cursor.current = { at: message.at, id: message.id };
          if (refreshOnNewInbound) window.dispatchEvent(new CustomEvent("tcr:whatsapp-inbound", { detail: message }));
        }
        const last = delta.messages.at(-1);
        if (last) {
          if (soundEnabled) void playNotificationSound(volume);
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            const notification = new Notification(last.name || "Nova mensagem no WhatsApp", {
              body: last.message || "Você recebeu uma nova mensagem na Central de Conversas.",
              icon: "/favicon.ico",
              tag: `tcr-whatsapp-${last.id}`
            });
            notification.onclick = () => {
              window.focus();
              window.location.href = `/admin/crm/whatsapp?period=today&phone=${encodeURIComponent(last.phone || "")}`;
              notification.close();
            };
          }
        }
      } catch {
        // Uma falha transitória não interrompe as próximas verificações.
      } finally {
        pollInFlight.current = false;
        if (!stopped) timer = window.setTimeout(poll, hasMore ? 0 : document.hidden ? BACKGROUND_POLL_MS : FOREGROUND_POLL_MS);
      }
    }

    timer = window.setTimeout(poll, FOREGROUND_POLL_MS);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [soundEnabled, volume, refreshOnNewInbound]);

  async function toggleSound() {
    const next = !soundEnabled;
    if (next) {
      const unlocked = await playNotificationSound(volume);
      setSoundEnabled(unlocked);
      window.localStorage.setItem(SOUND_STORAGE_KEY, unlocked ? "on" : "off");
      if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
      return;
    }
    setSoundEnabled(false);
    window.localStorage.setItem(SOUND_STORAGE_KEY, "off");
  }

  function changeVolume(nextVolume: number) {
    setVolume(nextVolume);
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(nextVolume));
  }

  return <div className="crmWhatsappSoundControls">
    <button
      aria-label={soundEnabled ? "Silenciar notificações do WhatsApp" : "Ativar som das notificações do WhatsApp"}
      className={`crmWhatsappHeaderIcon crmWhatsappSoundToggle ${soundEnabled ? "isEnabled" : ""}`}
      onClick={() => void toggleSound()}
      title={soundEnabled ? "Som liberado — clique para silenciar" : "Liberar som de novas mensagens neste navegador"}
      type="button"
    >
      <BellIcon muted={!soundEnabled}/>
      {liveUnreadCount ? <b>{liveUnreadCount}</b> : null}
      <span>{soundEnabled ? "Som liberado" : "Liberar som"}</span>
    </button>
    <label className="crmWhatsappVolumeControl" title={`Volume das notificações: ${volume}%`}>
      <span aria-hidden="true">🔊</span>
      <input
        aria-label="Volume das notificações do WhatsApp"
        max="100"
        min="0"
        onChange={(event) => changeVolume(Number(event.target.value))}
        onPointerUp={(event) => soundEnabled && void playNotificationSound(Number(event.currentTarget.value))}
        step="5"
        type="range"
        value={volume}
      />
      <output>{volume}%</output>
    </label>
  </div>;
}
