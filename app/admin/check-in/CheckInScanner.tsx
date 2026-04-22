"use client";

import { useEffect, useRef, useState } from "react";

type CheckInScannerProps = {
  action: (formData: FormData) => void | Promise<void>;
};

type BarcodeDetectorShape = {
  detect(video: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => BarcodeDetectorShape;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

export function CheckInScanner({ action }: CheckInScannerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [cameraStatus, setCameraStatus] = useState<
    "idle" | "unsupported" | "starting" | "scanning" | "error"
  >("idle");

  useEffect(() => {
    const savedDeviceName = window.localStorage.getItem("tcr-checkin-device");

    if (savedDeviceName && deviceInputRef.current) {
      deviceInputRef.current.value = savedDeviceName;
    }

    return () => {
      stopCamera();
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

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStatus((current) => (current === "scanning" ? "idle" : current));
  }

  async function startCamera() {
    if (!("BarcodeDetector" in window) || !window.BarcodeDetector) {
      setCameraStatus("unsupported");
      return;
    }

    try {
      setCameraStatus("starting");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment"
          }
        },
        audio: false
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        stopCamera();
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      scanningRef.current = true;
      setCameraStatus("scanning");

      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) {
          return;
        }

        try {
          const codes = await detector.detect(videoRef.current);
          const firstCode = codes[0]?.rawValue;

          if (firstCode) {
            submitCode(firstCode);
            return;
          }
        } catch {
          setCameraStatus("error");
          stopCamera();
          return;
        }

        window.setTimeout(scan, 350);
      };

      scan();
    } catch {
      setCameraStatus("error");
      stopCamera();
    }
  }

  const showCameraPreview = cameraStatus === "starting" || cameraStatus === "scanning";

  return (
    <form action={action} className="card form checkInForm" ref={formRef}>
      <div className="checkInFormHeader">
        <div>
          <h2>Validar ingresso</h2>
          <p>Use a câmera para QR Code ou cole o código manualmente.</p>
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
          <button className="secondaryButton" onClick={stopCamera} type="button">
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
          autoFocus
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
            window.localStorage.setItem("tcr-checkin-device", event.target.value.trim());
          }}
        />
      </label>
      <p className="muted">
        Dica: se o QR Code falhar, procure o pedido ou o ingresso no atendimento e cole o código aqui.
      </p>
      <button className="button fullButton" type="submit">
        Validar entrada
      </button>
    </form>
  );
}
