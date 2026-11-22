"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ContinuousScanGate, type LiveCheckInResult } from "@/features/check-in/continuous-scan";
import { useFormStatus } from "react-dom";
import { getCameraErrorMessage } from "@/features/check-in/camera-feedback";

type CheckInScannerProps = {
  action: (formData: FormData) => Promise<LiveCheckInResult>;
  eventId: string;
  eventTitle: string;
};

type ScannerControls = {
  stop(): void;
};

function PendingValidation({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return <>
    {pending ? <p role="status" className="formHint">Validando ingresso… Aguarde a confirmação antes de liberar a entrada.</p> : null}
    <fieldset disabled={pending} aria-busy={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gap: 16 }}>
      {children}
    </fieldset>
  </>;
}

export function CheckInScanner({ action, eventId, eventTitle }: CheckInScannerProps) {
  const router = useRouter();
  const gateRef = useRef(new ContinuousScanGate());
  const [validation, setValidation] = useState<LiveCheckInResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<ScannerControls | null>(null);
  const scanningRef = useRef(false);
  const cameraSessionRef = useRef(0);
  const cameraWantedRef = useRef(false);
  const recoveryAttemptsRef = useRef(0);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameWatchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unreadableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedCameraRef = useRef<string | undefined>(undefined);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraError, setCameraError] = useState("");
  const [showUnreadableHint, setShowUnreadableHint] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<
    "idle" | "unsupported" | "starting" | "scanning" | "interrupted" | "error"
  >("idle");

  useEffect(() => {
    let savedDeviceName: string | null = null;
    try { savedDeviceName = window.localStorage.getItem("ingresaas-checkin-device"); } catch { /* Camera remains usable when storage is disabled. */ }

    if (savedDeviceName && deviceInputRef.current) {
      deviceInputRef.current.value = savedDeviceName;
    }

    function releaseCameraWhenPageIsHidden() {
      if (document.visibilityState === "hidden") {
        // Another check-in tab needs the camera immediately. Remember whether
        // this operator was scanning so we can reacquire it on return.
        stopCamera(false, true);
        if (cameraWantedRef.current) setCameraStatus("interrupted");
      } else if (cameraWantedRef.current) {
        scheduleCameraRecovery(150);
      }
    }

    function releaseCameraWhenPageIsLeft() {
      stopCamera(false, true);
    }

    function resumeCameraAfterPageRestore() {
      if (cameraWantedRef.current && document.visibilityState === "visible") {
        scheduleCameraRecovery(150);
      }
    }

    document.addEventListener("visibilitychange", releaseCameraWhenPageIsHidden);
    window.addEventListener("pagehide", releaseCameraWhenPageIsLeft);
    window.addEventListener("pageshow", resumeCameraAfterPageRestore);

    return () => {
      document.removeEventListener("visibilitychange", releaseCameraWhenPageIsHidden);
      window.removeEventListener("pagehide", releaseCameraWhenPageIsLeft);
      window.removeEventListener("pageshow", resumeCameraAfterPageRestore);
      stopCamera(false);
    };
  }, []);

  function submitCode(code: string) {
    const normalizedCode = code.trim();

    if (!normalizedCode || !inputRef.current || !formRef.current) {
      return;
    }

    if (!gateRef.current.claim(normalizedCode)) return;
    setShowUnreadableHint(false);
    if (unreadableTimerRef.current) clearTimeout(unreadableTimerRef.current);
    inputRef.current.value = normalizedCode;
    formRef.current.requestSubmit();
  }

  function stopCamera(updateStatus = true, preserveIntent = false) {
    cameraSessionRef.current += 1;
    scanningRef.current = false;
    if (!preserveIntent) cameraWantedRef.current = false;
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = null;
    if (frameWatchdogRef.current) clearInterval(frameWatchdogRef.current);
    frameWatchdogRef.current = null;
    if (unreadableTimerRef.current) clearTimeout(unreadableTimerRef.current);
    unreadableTimerRef.current = null;
    setShowUnreadableHint(false);
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    if (videoRef.current) {
      const stream = videoRef.current.srcObject;

      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      videoRef.current.srcObject = null;
    }

    if (updateStatus) {
      setCameraStatus("idle");
    }
  }

  function scheduleCameraRecovery(delayMs: number) {
    if (!cameraWantedRef.current || document.visibilityState !== "visible") return;
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = setTimeout(() => {
      recoveryTimerRef.current = null;
      if (cameraWantedRef.current && document.visibilityState === "visible") void startCamera(true);
    }, delayMs);
  }

  function recoverInterruptedCamera() {
    stopCamera(false, true);
    setCameraStatus("interrupted");
    if (recoveryAttemptsRef.current < 1) {
      recoveryAttemptsRef.current += 1;
      scheduleCameraRecovery(400);
    }
  }

  function waitForCameraFrame(video: HTMLVideoElement, sessionId: number) {
    return new Promise<void>((resolve, reject) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (sessionId !== cameraSessionRef.current || document.visibilityState !== "visible") {
          clearInterval(timer);
          reject(new Error("Camera session changed"));
          return;
        }
        const stream = video.srcObject;
        const track = stream instanceof MediaStream ? stream.getVideoTracks()[0] : null;
        if (track?.readyState === "live" && !track.muted && video.readyState >= 2 && video.videoWidth > 0) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - startedAt > 3500) {
          clearInterval(timer);
          reject(new Error("Camera did not produce a frame"));
        }
      }, 100);
    });
  }

  async function startCamera(automatic = false) {
    if (scanningRef.current || document.visibilityState !== "visible") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setCameraStatus("unsupported");
      return;
    }
    setCameraError("");
    if (!automatic) recoveryAttemptsRef.current = 0;
    cameraWantedRef.current = true;
    setShowUnreadableHint(false);

    const sessionId = cameraSessionRef.current + 1;
    cameraSessionRef.current = sessionId;
    scanningRef.current = true;

    try {
      setCameraStatus("starting");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

      if (sessionId !== cameraSessionRef.current) return;
      if (!videoRef.current) {
        recoverInterruptedCamera();
        return;
      }

      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (sessionId !== cameraSessionRef.current) return;
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 500
      });
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            ...(selectedCameraRef.current
              ? { deviceId: { exact: selectedCameraRef.current } }
              : { facingMode: { ideal: "environment" } }),
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        },
        videoRef.current,
        (result) => {
          if (!scanningRef.current || sessionId !== cameraSessionRef.current) return;
          if (result) submitCode(result.getText());
          else gateRef.current.observeEmptyFrame();
        }
      );

      if (sessionId !== cameraSessionRef.current) {
        controls.stop();
        return;
      }

      scannerControlsRef.current = controls;
      await waitForCameraFrame(videoRef.current, sessionId);
      if (sessionId !== cameraSessionRef.current) return;

      const stream = videoRef.current.srcObject;

      if (stream instanceof MediaStream) {
        const handleCameraInterruption = () => {
          if (!scanningRef.current || sessionId !== cameraSessionRef.current) {
            return;
          }

          console.warn("[check-in-camera] Captura interrompida pelo navegador ou por outra aba");
          recoverInterruptedCamera();
        };

        stream.getVideoTracks().forEach((track) => {
          track.addEventListener("mute", handleCameraInterruption, { once: true });
          track.addEventListener("ended", handleCameraInterruption, { once: true });
        });
      }

      // Listing can fail independently of capture; never interrupt a working camera.
      void navigator.mediaDevices.enumerateDevices().then((devices) => {
        if (sessionId === cameraSessionRef.current) {
          setCameras(devices.filter((device) => device.kind === "videoinput"));
          const activeStream = videoRef.current?.srcObject;
          if (activeStream instanceof MediaStream) selectedCameraRef.current = activeStream.getVideoTracks()[0]?.getSettings().deviceId;
        }
      }).catch(() => {});
      setCameraStatus("scanning");
      unreadableTimerRef.current = setTimeout(() => {
        if (scanningRef.current && sessionId === cameraSessionRef.current) setShowUnreadableHint(true);
      }, 8000);
      let lastVideoTime = videoRef.current.currentTime;
      let stalledChecks = 0;
      frameWatchdogRef.current = setInterval(() => {
        const video = videoRef.current;
        if (!video || sessionId !== cameraSessionRef.current || document.visibilityState !== "visible") return;
        const currentStream = video.srcObject;
        const track = currentStream instanceof MediaStream ? currentStream.getVideoTracks()[0] : null;
        const advancing = video.currentTime > lastVideoTime;
        lastVideoTime = video.currentTime;
        stalledChecks = track?.readyState === "live" && !track.muted && video.videoWidth > 0 && advancing
          ? 0 : stalledChecks + 1;
        if (stalledChecks >= 3) recoverInterruptedCamera();
      }, 1000);
    } catch (error) {
      if (sessionId === cameraSessionRef.current) {
        console.error("[check-in-camera] Não foi possível manter a câmera ativa", error);
        if (error instanceof Error && ["NotAllowedError", "NotFoundError", "OverconstrainedError", "NotReadableError"].includes(error.name)) {
          stopCamera(false);
          setCameraError(getCameraErrorMessage(error));
          setCameraStatus("error");
        } else {
          recoverInterruptedCamera();
        }
      }
    }
  }

  async function validateWithoutClosingCamera(formData: FormData) {
    gateRef.current.pause();
    setValidation(null);
    try {
      const result = await action(formData);
      setValidation(result);
      router.refresh();
    } catch {
      setValidation({ status: "ERROR", message: "Não foi possível confirmar a validação. Confira a conexão ou entre novamente no painel. Não libere a entrada sem confirmação." });
    } finally {
      gateRef.current.complete();
      if (scanningRef.current) {
        unreadableTimerRef.current = setTimeout(() => {
          if (scanningRef.current) setShowUnreadableHint(true);
        }, 8000);
      }
    }
  }

  function restartCamera(cameraId = selectedCameraRef.current) {
    stopCamera(false);
    selectedCameraRef.current = cameraId;
    void startCamera();
  }

  const showCameraPreview = cameraStatus === "starting" || cameraStatus === "scanning";

  return (
    <form action={validateWithoutClosingCamera} className="checkInScannerCard form checkInForm" ref={formRef} onSubmit={() => gateRef.current.pause()}>
      <PendingValidation>
      <input type="hidden" name="eventId" value={eventId} />
      <div className="checkInFormHeader">
        <div>
          <h2>Validar ingresso</h2>
          <p>Evento selecionado: {eventTitle}</p>
        </div>
        <span>
          {cameraStatus === "scanning" ? "Lendo"
            : cameraStatus === "starting" ? "Reconectando"
            : cameraStatus === "interrupted" ? "Pausado"
            : cameraStatus === "error" ? "Câmera indisponível"
            : "Pronto"}
        </span>
      </div>

      <div className="scannerActions">
        <button
          className="button"
          onClick={() => void startCamera()}
          type="button"
          disabled={cameraStatus === "starting" || cameraStatus === "scanning"}
        >
          {cameraStatus === "interrupted" ? "Retomar câmera" : "Abrir câmera"}
        </button>
        {showCameraPreview ? (
          <button className="secondaryButton" onClick={() => restartCamera()} type="button">
            Reiniciar câmera
          </button>
        ) : null}
        {showCameraPreview ? (
          <button className="secondaryButton" onClick={() => stopCamera()} type="button">
            Parar leitura
          </button>
        ) : null}
      </div>

      {validation ? <div className={`checkInCurrentResult checkIn${validation.status}`} role="alert" aria-live="assertive">
        <div className="checkInResultHeadline"><strong>{validation.status === "APPROVED" ? "Entrada liberada" : validation.status === "ALREADY_USED" ? "Já utilizado — não libere" : "Não libere a entrada"}</strong></div>
        <p>{validation.message}</p>
        {validation.ticket ? <div className="checkInResultSummary">
          <span><small>Comprador</small><strong>{validation.ticket.buyerName}</strong></span>
          <span><small>Ingresso</small><strong>{validation.ticket.lotName}</strong></span>
          <span><small>Código</small><strong>{validation.ticket.code}</strong></span>
          {validation.ticket.checkedAt ? <span><small>Validação registrada</small><strong>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" }).format(new Date(validation.ticket.checkedAt))}</strong></span> : null}
        </div> : null}
        {cameraStatus === "scanning" ? <small>Retire este QR Code e apresente o próximo. A câmera continua aberta.</small> : null}
      </div> : null}

      {cameras.length > 1 ? <label className="field">
        <span>Câmera para leitura</span>
        <select value={selectedCameraRef.current || ""} onChange={(event) => restartCamera(event.target.value)} disabled={cameraStatus === "starting"}>
          <option value="">Traseira automática</option>
          {cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Câmera ${index + 1}`}</option>)}
        </select>
      </label> : null}

      {showCameraPreview ? (
        <div className="scannerFrame">
          <video muted playsInline ref={videoRef} />
          <span>Leitura contínua · posicione o QR Code no centro</span>
        </div>
      ) : null}

      {cameraStatus === "unsupported" ? (
        <p className="formHint">
          Este navegador não liberou leitura automática. Cole ou digite o código abaixo.
        </p>
      ) : null}

      {cameraStatus === "error" ? (
        <p className="formHint">
          {cameraError || "Não consegui acessar a câmera. Confira a permissão do navegador ou valide pelo código."}
        </p>
      ) : null}

      {cameraStatus === "interrupted" ? (
        <p className="formHint">
          A câmera ficou sem imagem ou foi interrompida por outra aba. Feche a câmera no outro leitor e toque em Retomar câmera se ela não voltar sozinha.
        </p>
      ) : null}

      {cameraStatus === "scanning" && showUnreadableHint ? (
        <p className="formHint" role="status">
          Nenhum QR Code foi identificado. Aumente o brilho do ingresso, ajuste foco e distância ou digite o código impresso abaixo. Não libere a entrada sem a confirmação “Entrada liberada”.
        </p>
      ) : null}

      <label className="field">
        <span>Código ou token do QR Code</span>
        <input
          name="code"
          placeholder="Cole ou leia o código do ingresso"
          ref={inputRef}
          required
        />
      </label>
      <label className="field">
        <span>Dispositivo/portaria</span>
        <input
          name="deviceName"
          placeholder="Ex: Portaria principal"
          ref={deviceInputRef}
          onBlur={(event) => {
            try { window.localStorage.setItem("ingresaas-checkin-device", event.target.value.trim()); } catch { /* Optional preference. */ }
          }}
        />
      </label>
      <p className="muted">
        Dica: se o QR Code falhar, procure o pedido ou o ingresso no atendimento e cole o código aqui. Isso costuma resolver mais rápido do que insistir na câmera.
      </p>
      <button className="button fullButton" type="submit">
        Validar entrada
      </button>
      </PendingValidation>
    </form>
  );
}
