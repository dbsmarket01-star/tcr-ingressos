"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SOUND_STORAGE_KEY = "tcr-whatsapp-notification-sound";
const LAST_MESSAGE_STORAGE_KEY = "tcr-whatsapp-last-inbound-message";
const REFRESH_INTERVAL_MS = 6_000;

function BellIcon({ muted }: { muted: boolean }) {
  return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>
    {muted ? <path d="m4 4 16 16"/> : null}
  </svg>;
}

function playNotificationSound() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
  gain.connect(context.destination);

  [880, 1_175].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.11);
    oscillator.stop(context.currentTime + 0.3 + index * 0.11);
  });
  window.setTimeout(() => void context.close(), 650);
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

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem(SOUND_STORAGE_KEY) === "on");
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
    if (soundEnabled) playNotificationSound();
  }, [latestInboundId, soundEnabled]);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off");
    if (next) playNotificationSound();
  }

  return <button
    aria-label={soundEnabled ? "Silenciar notificações do WhatsApp" : "Ativar som das notificações do WhatsApp"}
    className={`crmWhatsappHeaderIcon crmWhatsappSoundToggle ${soundEnabled ? "isEnabled" : ""}`}
    onClick={toggleSound}
    title={soundEnabled ? "Som ligado — clique para silenciar" : "Ativar som de novas mensagens"}
    type="button"
  >
    <BellIcon muted={!soundEnabled}/>
    {unreadCount ? <b>{unreadCount}</b> : null}
    <span>{soundEnabled ? "Som ligado" : "Ativar som"}</span>
  </button>;
}
