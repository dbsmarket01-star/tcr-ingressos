"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SOUND_STORAGE_KEY = "tcr-whatsapp-notification-sound";
const VOLUME_STORAGE_KEY = "tcr-whatsapp-notification-volume";
const LAST_MESSAGE_STORAGE_KEY = "tcr-whatsapp-last-inbound-message";
const REFRESH_INTERVAL_MS = 6_000;
const DEFAULT_VOLUME = 85;

function BellIcon({ muted }: { muted: boolean }) {
  return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>
    {muted ? <path d="m4 4 16 16"/> : null}
  </svg>;
}

function playNotificationSound(volume: number) {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
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
  window.setTimeout(() => void context.close(), 1_450);
}

export function WhatsAppNotificationWatcher({
  latestInboundId,
  unreadCount
}: {
  latestInboundId: string | null;
  unreadCount: number;
}) {
  const router = useRouter();
  const initialized = useRef(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem(SOUND_STORAGE_KEY) === "on");
    const storedVolumeValue = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    const storedVolume = storedVolumeValue === null ? NaN : Number(storedVolumeValue);
    if (Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 100) setVolume(storedVolume);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (!latestInboundId) return;
    const lastMessageId = window.sessionStorage.getItem(LAST_MESSAGE_STORAGE_KEY);
    if (!initialized.current) {
      initialized.current = true;
      window.sessionStorage.setItem(LAST_MESSAGE_STORAGE_KEY, latestInboundId);
      return;
    }
    if (lastMessageId === latestInboundId) return;
    window.sessionStorage.setItem(LAST_MESSAGE_STORAGE_KEY, latestInboundId);
    if (soundEnabled) playNotificationSound(volume);
  }, [latestInboundId, soundEnabled, volume]);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off");
    if (next) playNotificationSound(volume);
  }

  function changeVolume(nextVolume: number) {
    setVolume(nextVolume);
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(nextVolume));
  }

  return <div className="crmWhatsappSoundControls">
    <button
      aria-label={soundEnabled ? "Silenciar notificações do WhatsApp" : "Ativar som das notificações do WhatsApp"}
      className={`crmWhatsappHeaderIcon crmWhatsappSoundToggle ${soundEnabled ? "isEnabled" : ""}`}
      onClick={toggleSound}
      title={soundEnabled ? "Som ligado — clique para silenciar" : "Ativar som de novas mensagens"}
      type="button"
    >
      <BellIcon muted={!soundEnabled}/>
      {unreadCount ? <b>{unreadCount}</b> : null}
      <span>{soundEnabled ? "Som ligado" : "Ativar som"}</span>
    </button>
    <label className="crmWhatsappVolumeControl" title={`Volume das notificações: ${volume}%`}>
      <span aria-hidden="true">🔊</span>
      <input
        aria-label="Volume das notificações do WhatsApp"
        max="100"
        min="0"
        onChange={(event) => changeVolume(Number(event.target.value))}
        onPointerUp={(event) => soundEnabled && playNotificationSound(Number(event.currentTarget.value))}
        step="5"
        type="range"
        value={volume}
      />
      <output>{volume}%</output>
    </label>
  </div>;
}
