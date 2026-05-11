"use client";

import { type CSSProperties, useEffect, useState } from "react";
import {
  MAX_IMAGE_CROP_ZOOM,
  MIN_IMAGE_CROP_ZOOM,
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
  aspect?: "banner" | "lead" | "map" | "share";
  cropFieldName?: string;
  currentCropValue?: string | null;
  includeImageMetaFields?: boolean;
  applyMode?: "live" | "manual";
};

type ImageMeta = {
  width: number;
  height: number;
  ratio: number;
};

const recommendedRatios = {
  banner: 1920 / 840,
  lead: 4 / 5,
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
  lead: [
    { label: "Auto", crop: { x: 50, y: 50 } },
    { label: "Rosto alto", crop: { x: 50, y: 24 } },
    { label: "Centro", crop: { x: 50, y: 50 } },
    { label: "Esquerda", crop: { x: 34, y: 50 } },
    { label: "Direita", crop: { x: 66, y: 50 } }
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

  return sanitizeImageCrop({
    x: 50,
    y: 50,
    zoom: 1
  });
}

function shouldUseAutoFit(rawCrop?: string | null) {
  const parsedCrop = parseImageCrop(rawCrop);

  if (!parsedCrop) {
    return true;
  }

  return Math.abs(parsedCrop.x - 50) < 0.01 && Math.abs(parsedCrop.y - 50) < 0.01 && parsedCrop.zoom <= 1;
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

function cropPreviewStyle(crop: ImageCrop): CSSProperties {
  return {
    objectFit: "contain",
    objectPosition: `${crop.x}% ${crop.y}%`,
    transform: `scale(${crop.zoom})`,
    transformOrigin: `${crop.x}% ${crop.y}%`
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
  currentCropValue,
  includeImageMetaFields = false,
  applyMode = "live"
}: ImageUploadFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl ?? null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);
  const [crop, setCrop] = useState<ImageCrop>(() => sanitizeImageCrop(parseImageCrop(currentCropValue)));
  const [appliedCropValue, setAppliedCropValue] = useState<string>(() => stringifyImageCrop(parseImageCrop(currentCropValue)));
  const [appliedPreviewUrl, setAppliedPreviewUrl] = useState<string | null>(currentImageUrl ?? null);
  const [appliedImageMeta, setAppliedImageMeta] = useState<ImageMeta | null>(null);
  const [shouldAutoFitCrop, setShouldAutoFitCrop] = useState<boolean>(() => shouldUseAutoFit(currentCropValue));

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
    setAppliedCropValue(stringifyImageCrop(parseImageCrop(currentCropValue)));
    setAppliedPreviewUrl(currentImageUrl ?? null);
    setShouldAutoFitCrop(shouldUseAutoFit(currentCropValue));
  }, [currentCropValue, currentImageUrl]);

  useEffect(() => {
    if (!shouldAutoFitCrop || !cropFieldName || !imageMeta) {
      return;
    }

    setCrop(buildDefaultCrop(imageMeta, aspect));
    setShouldAutoFitCrop(false);
  }, [aspect, cropFieldName, imageMeta, shouldAutoFitCrop]);

  useEffect(() => {
    if (applyMode !== "manual" || !imageMeta) {
      return;
    }

    if (appliedPreviewUrl && appliedPreviewUrl === previewUrl) {
      setAppliedImageMeta(imageMeta);
    }
  }, [appliedPreviewUrl, applyMode, imageMeta, previewUrl]);

  const aspectAnalysis = analyzeAspect(imageMeta, aspect);
  const cropValue = stringifyImageCrop(crop);
  const defaultCrop = buildDefaultCrop(imageMeta, aspect);
  const presets = cropPresets[aspect];
  const publicPreviewStyle = cropPreviewStyle(crop);

  function emitAppliedEvent() {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new Event("lead-email-image-applied"));
  }

  function applyCrop() {
    setAppliedCropValue(cropValue);
    setAppliedPreviewUrl(previewUrl);
    setAppliedImageMeta(imageMeta);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        emitAppliedEvent();
      });
    }
  }

  function updateCrop(partial: Partial<ImageCrop>) {
    setCrop((current) =>
      sanitizeImageCrop({
        ...current,
        ...partial
      })
    );
  }

  function nudgeCrop(axis: "x" | "y" | "zoom", delta: number) {
    setCrop((current) =>
      sanitizeImageCrop({
        ...current,
        [axis]: Number((current[axis] + delta).toFixed(axis === "zoom" ? 2 : 1))
      })
    );
  }

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
              <strong>Imagem completa e prévia pública</strong>
              <small>A arte entra inteira por padrão. Use o zoom e a posição só quando quiser aproximar ou ajustar o enquadramento.</small>
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
                  onClick={() => updateCrop(preset.crop)}
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
            {applyMode === "manual" ? (
              <button
                type="button"
                className="imageCropApplyButton"
                onClick={applyCrop}
              >
                Aplicar
              </button>
            ) : null}
          </div>
          <div className="imageCropFineTuning" aria-label="Ajuste fino do enquadramento">
            <div className="imageCropNudgeGrid">
              <button type="button" className="imageCropNudgeButton" onClick={() => nudgeCrop("y", -2)}>
                Cima
              </button>
              <button type="button" className="imageCropNudgeButton" onClick={() => nudgeCrop("x", -2)}>
                Esquerda
              </button>
              <button type="button" className="imageCropNudgeButton" onClick={() => nudgeCrop("x", 2)}>
                Direita
              </button>
              <button type="button" className="imageCropNudgeButton" onClick={() => nudgeCrop("y", 2)}>
                Baixo
              </button>
            </div>
            <div className="imageCropZoomButtons">
              <button type="button" className="imageCropNudgeButton" onClick={() => nudgeCrop("zoom", -0.1)}>
                Afastar
              </button>
              <button type="button" className="imageCropNudgeButton" onClick={() => nudgeCrop("zoom", 0.1)}>
                Aproximar
              </button>
            </div>
          </div>
          <div className="imageCropWorkspace">
            <div className="imageCropPanel">
              <div className="imageCropPanelHeader">
                <strong>Arte completa</strong>
                <small>Visualização sem corte para conferir tudo que existe na imagem.</small>
              </div>
              <div className={`imageCropOriginalStage imageCropOriginalStage${aspect}`}>
                <img src={previewUrl} alt="" />
              </div>
            </div>
            <div className="imageCropPanel">
              <div className="imageCropPanelHeader">
                <strong>Prévia pública</strong>
                <small>É assim que o cliente verá essa imagem no espaço final.</small>
              </div>
              <div className={`imageCropStage imageCropStage${aspect}`}>
                <div className={`imageCropSafeArea imageCropSafeArea${aspect}`}>
                  <span>Área segura</span>
                </div>
                <img src={previewUrl} alt="" style={publicPreviewStyle} />
              </div>
            </div>
          </div>
          <div className="imageCropControls">
            <label className="field">
              <span>Zoom</span>
              <input
                type="range"
                min={String(MIN_IMAGE_CROP_ZOOM)}
                max={String(MAX_IMAGE_CROP_ZOOM)}
                step="0.02"
                value={crop.zoom}
                onChange={(event) =>
                  updateCrop({
                    zoom: Number(event.target.value)
                  })
                }
              />
              <small>{crop.zoom < 1 ? `${crop.zoom.toFixed(2)}x · afastado` : `${crop.zoom.toFixed(2)}x`}</small>
              <input
                className="imageCropNumberInput"
                type="number"
                min={MIN_IMAGE_CROP_ZOOM}
                max={MAX_IMAGE_CROP_ZOOM}
                step="0.01"
                value={crop.zoom}
                onChange={(event) =>
                  updateCrop({
                    zoom: Number(event.target.value)
                  })
                }
              />
            </label>
            <label className="field">
              <span>Horizontal</span>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={crop.x}
                onChange={(event) =>
                  updateCrop({
                    x: Number(event.target.value)
                  })
                }
              />
              <small>{crop.x.toFixed(1)}%</small>
              <input
                className="imageCropNumberInput"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={crop.x}
                onChange={(event) =>
                  updateCrop({
                    x: Number(event.target.value)
                  })
                }
              />
            </label>
            <label className="field">
              <span>Vertical</span>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={crop.y}
                onChange={(event) =>
                  updateCrop({
                    y: Number(event.target.value)
                  })
                }
              />
              <small>{crop.y.toFixed(1)}%</small>
              <input
                className="imageCropNumberInput"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={crop.y}
                onChange={(event) =>
                  updateCrop({
                    y: Number(event.target.value)
                  })
                }
              />
            </label>
          </div>
          <input type="hidden" name={cropFieldName} value={applyMode === "manual" ? appliedCropValue : cropValue} />
          <input type="hidden" name={`${name}AppliedPreviewUrl`} value={applyMode === "manual" ? appliedPreviewUrl ?? "" : previewUrl ?? ""} />
          {includeImageMetaFields && (applyMode === "manual" ? appliedImageMeta : imageMeta) ? (
            <>
              <input
                type="hidden"
                name={`${name}Width`}
                value={String((applyMode === "manual" ? appliedImageMeta : imageMeta)?.width ?? "")}
              />
              <input
                type="hidden"
                name={`${name}Height`}
                value={String((applyMode === "manual" ? appliedImageMeta : imageMeta)?.height ?? "")}
              />
            </>
          ) : null}
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
