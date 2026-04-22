"use client";

import { useEffect, useState } from "react";

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
  aspect = "banner"
}: ImageUploadFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl ?? null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);

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

  const aspectAnalysis = analyzeAspect(imageMeta, aspect);

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
      {previewUrl ? (
        <div className="imageUploadPublicPreview">
          <span>Prévia aproximada do espaço público</span>
          <div className={`imageUploadPublicFrame imageUploadPublicFrame${aspect}`}>
            <img src={previewUrl} alt="" />
          </div>
          {imageMeta ? (
            <small>
              Arquivo atual: {imageMeta.width} x {imageMeta.height} px
            </small>
          ) : null}
        </div>
      ) : null}
      {aspectAnalysis ? (
        <div className={`imageAspectNotice is${aspectAnalysis.tone}`}>
          <strong>{aspectAnalysis.title}</strong>
          <small>{aspectAnalysis.text}</small>
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
          setLocalError(null);
        }}
      />
      {localError ? <small className="fieldError">{localError}</small> : null}
      {help ? <small>{help}</small> : null}
      <span className="uploadActionText">Escolher ou trocar imagem</span>
    </label>
  );
}
