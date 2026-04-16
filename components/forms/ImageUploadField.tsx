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

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

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
      <span className="uploadActionText">Clique para escolher ou trocar a imagem</span>
    </label>
  );
}
