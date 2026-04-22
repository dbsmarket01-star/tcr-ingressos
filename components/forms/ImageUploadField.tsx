"use client";

import { useEffect, useState } from "react";
import {
  type ImageCrop,
  parseImageCrop,
  sanitizeImageCrop,
  stringifyImageCrop
} from "@/lib/image-crop";

const MAX_PREVIEW_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

type ImageUploadFieldProps = {
  name: string;
  label: string;
  help?: string;
  currentImageUrl?: string | null;
  emptyText?: string;
  recommendedSize?: string;
  usageHint?: string;
  aspect?: "banner" | "map" | "share";
  cropFieldName?: string;
  currentCropValue?: string | null;
};

type ImageMeta = {
  width: number;
  height: number;
  ratio: number;
};

const recommendedRatios = {
  banner: 1920 / 840,
  map: 4 / 3,
  share: 1.91
} satisfies Record<NonNullable<ImageUploadFieldProps["aspect"]>, number>;

const cropPresets = {
  banner: [
    { label: "Auto", crop: { x: 50, y: 50 } },
    { label: "Topo", crop: { x: 50, y: 28 } },
    { label: "Centro", crop: { x: 50, y: 50 } },
    { label: "Base", crop: { x: 50, y: 72 } }
  ],
  map: [
    { label: "Auto", crop: { x: 50, y: 50 } },
    { label: "Centro", crop: { x: 50, y: 50 } },
    { label: "Esquerda", crop: { x: 32, y: 50 } },
    { label: "Direita", crop: { x: 68, y: 50 } }
  ],
  share: [
    { label: "Auto", crop: { x: 50, y: 50 } },
    { label: "Centro", crop: { x: 50, y: 50 } },
    { label: "Esquerda", crop: { x: 32, y: 50 } },
    { label: "Direita", crop: { x: 68, y: 50 } }
  ]
} satisfies Record<NonNullable<ImageUploadFieldProps["aspect"]>, Array<{ label: string; crop: Partial<ImageCrop> }>>;

function buildDefaultCrop(meta: ImageMeta | null, aspect: NonNullable<ImageUploadFieldProps["aspect"]>): ImageCrop {
  if (!meta) {
    return sanitizeImageCrop(null);
  }

  const recommendedRatio = recommendedRatios[aspect];
  const fitZoom = Math.min(1, Math.min(meta.ratio / recommendedRatio, recommendedRatio / meta.ratio));

  return sanitizeImageCrop({
    x: 50,
    y: 50,
    zoom: Number(fitZoom.toFixed(2))
  });
}

function analyzeAspect(meta: ImageMeta | null, aspect: NonNullable<ImageUploadFieldProps["aspect"]>) {
  if (!meta) {
    return null;
  }

  const recommendedRatio = recommendedRatios[aspect];
  const ratioDifference = meta.ratio / recommendedRatio;

  if (ratioDifference < 0.88) {
    return {
      tone: "warning",
      title: "A arte está mais alta que o ideal",
      text:
        aspect === "banner"
          ? "No topo público podem sobrar faixas laterais e o banner parecer menor do que você imaginou."
          : "A imagem está mais vertical do que o recomendado para este espaço."
    };
  }

  if (ratioDifference > 1.12) {
    return {
      tone: "info",
      title: "A arte está mais panorâmica que o ideal",
      text:
        aspect === "banner"
          ? "Ela tende a ocupar bem a largura, mas pode sobrar menos altura útil para textos e rostos."
          : "A imagem está mais horizontal do que o recomendado para este espaço."
    };
  }

  return {
    tone: "success",
    title: "A proporção está bem próxima do ideal",
    text:
      aspect === "banner"
        ? "A prévia indica um encaixe bom no topo público, com menos chance de faixas ou sensação de aperto."
        : "A prévia indica um encaixe equilibrado para este espaço."
  };
}

export function ImageUploadField({
  name,
  label,
  help,
  currentImageUrl,
  emptyText = "Nenhuma imagem selecionada",
  recommendedSize,
  usageHint,
  aspect = "banner",
  cropFieldName,
  currentCropValue
}: ImageUploadFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl ?? null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);
  const [crop, setCrop] = useState<ImageCrop>(() => sanitizeImageCrop(parseImageCrop(currentCropValue)));
  const [shouldAutoFitCrop, setShouldAutoFitCrop] = useState<boolean>(() => !currentCropValue);

  useEffect(() => {
    if (!previewUrl) {
      setImageMeta(null);
      return;
    }

    const image = new window.Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        setImageMeta(null);
        return;
      }

      setImageMeta({
        width: image.naturalWidth,
        height: image.naturalHeight,
        ratio: image.naturalWidth / image.naturalHeight
      });
    };
    image.onerror = () => setImageMeta(null);
    image.src = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  useEffect(() => {
    setCrop(sanitizeImageCrop(parseImageCrop(currentCropValue)));
    setShouldAutoFitCrop(!currentCropValue);
  }, [currentCropValue]);

  useEffect(() => {
    if (!shouldAutoFitCrop || !cropFieldName || !imageMeta) {
      return;
    }

    setCrop(buildDefaultCrop(imageMeta, aspect));
    setShouldAutoFitCrop(false);
  }, [aspect, cropFieldName, imageMeta, shouldAutoFitCrop]);

  const aspectAnalysis = analyzeAspect(imageMeta, aspect);
  const cropValue = stringifyImageCrop(crop);
  const defaultCrop = buildDefaultCrop(imageMeta, aspect);
  const presets = cropPresets[aspect];

  return (
    <label className={`field fileDropField imageUploadField imageUpload${aspect}`}>
      <span>{label}</span>
      {recommendedSize || usageHint ? (
        <div className="uploadGuidance">
          {recommendedSize ? <strong>{recommendedSize}</strong> : null}
          {usageHint ? <small>{usageHint}</small> : null}
        </div>
      ) : null}
      {previewUrl ? (
        <div className="imageUploadPreview">
          <img src={previewUrl} alt="" />
        </div>
      ) : (
        <div className="imageUploadPlaceholder">{emptyText}</div>
      )}
      {aspectAnalysis ? (
        <div className={`imageAspectNotice is${aspectAnalysis.tone}`}>
          <strong>{aspectAnalysis.title}</strong>
          <small>{aspectAnalysis.text}</small>
        </div>
      ) : null}
      {previewUrl && cropFieldName ? (
        <div className="imageCropTool">
          <div className="imageCropToolHeader">
            <div>
              <strong>Prévia editável do espaço público</strong>
              <small>É esse enquadramento que usamos para o cliente final. A imagem entra inteira por padrão e você ajusta só se quiser.</small>
            </div>
            {imageMeta ? <span className="imageCropMeta">{imageMeta.width} x {imageMeta.height} px</span> : null}
          </div>
          <div className="imageCropActions">
            <div className="imageCropPresetRow" role="group" aria-label="Presets rápidos de enquadramento">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="imageCropPresetButton"
                  onClick={() =>
                    setCrop((current) =>
                      sanitizeImageCrop({
                        ...current,
                        ...preset.crop
                      })
                    )
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="imageCropResetButton"
              onClick={() => setCrop(defaultCrop)}
            >
              Restaurar ajuste automático
            </button>
          </div>
          <div className={`imageCropStage imageCropStage${aspect}`}>
            <div className={`imageCropSafeArea imageCropSafeArea${aspect}`}>
              <span>Área segura</span>
            </div>
            <img
              src={previewUrl}
              alt=""
              style={{
                objectPosition: `${crop.x}% ${crop.y}%`,
                transform: `scale(${crop.zoom})`,
                transformOrigin: `${crop.x}% ${crop.y}%`
              }}
            />
          </div>
          <div className="imageCropControls">
            <label className="field">
              <span>Zoom</span>
              <input
                type="range"
                min="0.45"
                max="2.5"
                step="0.05"
                value={crop.zoom}
                onChange={(event) =>
                  setCrop((current) =>
                    sanitizeImageCrop({
                      ...current,
                      zoom: Number(event.target.value)
                    })
                  )
                }
              />
              <small>{crop.zoom < 1 ? `${crop.zoom.toFixed(2)}x · afastado` : `${crop.zoom.toFixed(2)}x`}</small>
            </label>
            <label className="field">
              <span>Horizontal</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={crop.x}
                onChange={(event) =>
                  setCrop((current) =>
                    sanitizeImageCrop({
                      ...current,
                      x: Number(event.target.value)
                    })
                  )
                }
              />
              <small>{Math.round(crop.x)}%</small>
            </label>
            <label className="field">
              <span>Vertical</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={crop.y}
                onChange={(event) =>
                  setCrop((current) =>
                    sanitizeImageCrop({
                      ...current,
                      y: Number(event.target.value)
                    })
                  )
                }
              />
              <small>{Math.round(crop.y)}%</small>
            </label>
          </div>
          <input type="hidden" name={cropFieldName} value={cropValue} />
        </div>
      ) : null}
      <input
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (!file) {
            setPreviewUrl(currentImageUrl ?? null);
            setLocalError(null);
            return;
          }

          if (file.size > MAX_PREVIEW_IMAGE_SIZE_BYTES) {
            event.target.value = "";
            setLocalError("Imagem acima de 10MB. Comprima a arte ou envie uma versao menor.");
            setPreviewUrl(currentImageUrl ?? null);
            return;
          }

          const nextObjectUrl = URL.createObjectURL(file);

          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }

          setObjectUrl(nextObjectUrl);
          setPreviewUrl(nextObjectUrl);
          setShouldAutoFitCrop(true);
          setCrop(sanitizeImageCrop(null));
          setLocalError(null);
        }}
      />
      {localError ? <small className="fieldError">{localError}</small> : null}
      {help ? <small>{help}</small> : null}
      <span className="uploadActionText">Escolher ou trocar imagem</span>
    </label>
  );
}
