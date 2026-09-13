"use client";

import { useEffect, useRef, useState } from "react";

type CheckInScannerProps = {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  eventTitle: string;
};

type ScannerControls = {
  stop(): void;
};

export function CheckInScanner({ action, eventId, eventTitle }: CheckInScannerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<ScannerControls | null>(null);
  const scanningRef = useRef(false);
  const cameraSessionRef = useRef(0);
  const [cameraStatus, setCameraStatus] = useState<
    "idle" | "unsupported" | "starting" | "scanning" | "error"
  >("idle");

  useEffect(() => {
    const savedDeviceName = window.localStorage.getItem("ingresaas-checkin-device");

    if (savedDeviceName && deviceInputRef.current) {
      deviceInputRef.current.value = savedDeviceName;
    }

    return () => {
      stopCamera(false);
    };
  }, []);

  function submitCode(code: string) {
    const normalizedCode = code.trim();

    if (!normalizedCode || !inputRef.current || !formRef.current) {
      return;
    }

    inputRef.current.value = normalizedCode;
    stopCamera();
    window.setTimeout(() => formRef.current?.requestSubmit(), 100);
  }

  function stopCamera(updateStatus = true) {
    cameraSessionRef.current += 1;
    scanningRef.current = false;
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

  async function startCamera() {
    if (scanningRef.current || cameraStatus === "starting") {
      return;
    }

    const sessionId = cameraSessionRef.current + 1;
    cameraSessionRef.current = sessionId;
    scanningRef.current = true;

    try {
      setCameraStatus("starting");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

      if (!videoRef.current || sessionId !== cameraSessionRef.current) {
        scanningRef.current = false;
        return;
      }

      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 500
      });
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: {
              ideal: "environment"
            },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        },
        videoRef.current,
        (result) => {
          if (result && scanningRef.current && sessionId === cameraSessionRef.current) {
            submitCode(result.getText());
          }
        }
      );

      if (sessionId !== cameraSessionRef.current) {
        controls.stop();
        return;
      }

      scannerControlsRef.current = controls;
      setCameraStatus("scanning");
    } catch (error) {
      if (sessionId === cameraSessionRef.current) {
        console.error("[check-in-camera] Não foi possível manter a câmera ativa", error);
        stopCamera(false);
        setCameraStatus("error");
      }
    }
  }

  const showCameraPreview = cameraStatus === "starting" || cameraStatus === "scanning";

  return (
    <form action={action} className="checkInScannerCard form checkInForm" ref={formRef}>
      <input type="hidden" name="eventId" value={eventId} />
      <div className="checkInFormHeader">
        <div>
          <h2>Validar ingresso</h2>
          <p>Evento selecionado: {eventTitle}</p>
        </div>
        <span>{cameraStatus === "scanning" ? "Lendo" : "Pronto"}</span>
      </div>

      <div className="scannerActions">
        <button
          className="button"
          onClick={startCamera}
          type="button"
          disabled={cameraStatus === "starting" || cameraStatus === "scanning"}
        >
          Abrir câmera
        </button>
        {showCameraPreview ? (
          <button className="secondaryButton" onClick={() => stopCamera()} type="button">
            Parar leitura
          </button>
        ) : null}
      </div>

      {showCameraPreview ? (
        <div className="scannerFrame">
          <video muted playsInline ref={videoRef} />
          <span>Posicione o QR Code no centro</span>
        </div>
      ) : null}

      {cameraStatus === "unsupported" ? (
        <p className="formHint">
          Este navegador não liberou leitura automática. Cole ou digite o código abaixo.
        </p>
      ) : null}

      {cameraStatus === "error" ? (
        <p className="formHint">
          Não consegui acessar a câmera. Confira a permissão do navegador ou valide pelo código.
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
            window.localStorage.setItem("ingresaas-checkin-device", event.target.value.trim());
          }}
        />
      </label>
      <p className="muted">
        Dica: se o QR Code falhar, procure o pedido ou o ingresso no atendimento e cole o código aqui. Isso costuma resolver mais rápido do que insistir na câmera.
      </p>
      <button className="button fullButton" type="submit">
        Validar entrada
      </button>
    </form>
  );
}
