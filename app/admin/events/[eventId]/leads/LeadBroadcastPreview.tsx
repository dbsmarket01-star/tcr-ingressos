"use client";

import { useEffect, useRef, useState } from "react";
import { parseImageCrop } from "@/lib/image-crop";
const EMAIL_IMAGE_WIDTH = 1200;
const EMAIL_IMAGE_HEIGHT = 630;

type LeadBroadcastPreviewProps = {
  brandName: string;
  eventTitle: string;
  supportEmail?: string | null;
  defaultCtaLabel: string;
  defaultDestinationUrl: string;
};

type PreviewState = {
  subject: string;
  body: string;
  ctaLabel: string;
  destinationUrl: string;
  imageUrl: string | null;
  imageName: string | null;
  imageCrop: string | null;
};

type PreviewImageMeta = {
  width: number;
  height: number;
};

function emptyPreviewState(props: LeadBroadcastPreviewProps): PreviewState {
  return {
    subject: "",
    body: "",
    ctaLabel: props.defaultCtaLabel,
    destinationUrl: props.defaultDestinationUrl,
    imageUrl: null,
    imageName: null,
    imageCrop: null
  };
}

export function LeadBroadcastPreview(props: LeadBroadcastPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(() => emptyPreviewState(props));
  const [imageMeta, setImageMeta] = useState<PreviewImageMeta | null>(null);

  useEffect(() => {
    const form = containerRef.current?.closest("form");

    if (!form) {
      return;
    }

    const subjectInput = form.querySelector<HTMLInputElement>('input[name="subject"]');
    const bodyInput = form.querySelector<HTMLTextAreaElement>('textarea[name="body"]');
    const ctaLabelInput = form.querySelector<HTMLInputElement>('input[name="ctaLabel"]');
    const destinationInput = form.querySelector<HTMLInputElement>('input[name="destinationUrl"]');
    const imageInput = form.querySelector<HTMLInputElement>('input[name="imageFile"]');
    const imageCropInput = form.querySelector<HTMLInputElement>('input[name="imageCrop"]');

    const updatePreview = () => {
      const nextImageFile = imageInput?.files?.[0] ?? null;

      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }

      const nextImageUrl = nextImageFile ? URL.createObjectURL(nextImageFile) : null;
      imageUrlRef.current = nextImageUrl;

      setPreview({
        subject: subjectInput?.value.trim() || "",
        body: bodyInput?.value || "",
        ctaLabel: ctaLabelInput?.value.trim() || props.defaultCtaLabel,
        destinationUrl: destinationInput?.value.trim() || props.defaultDestinationUrl,
        imageUrl: nextImageUrl,
        imageName: nextImageFile?.name ?? null,
        imageCrop: imageCropInput?.value.trim() || null
      });
    };

    const disposers: Array<() => void> = [];
    const inputs = [subjectInput, bodyInput, ctaLabelInput, destinationInput, imageInput, imageCropInput].filter(
      (input): input is HTMLInputElement | HTMLTextAreaElement => Boolean(input)
    );

    inputs.forEach((input) => {
      const eventName = input instanceof HTMLInputElement && input.type === "file" ? "change" : "input";
      input.addEventListener(eventName, updatePreview);
      disposers.push(() => input.removeEventListener(eventName, updatePreview));
    });

    updatePreview();

    return () => {
      disposers.forEach((dispose) => dispose());

      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    };
  }, [props.defaultCtaLabel, props.defaultDestinationUrl]);

  useEffect(() => {
    if (!preview.imageUrl) {
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
        height: image.naturalHeight
      });
    };
    image.onerror = () => setImageMeta(null);
    image.src = preview.imageUrl;
  }, [preview.imageUrl]);

  const paragraphs = preview.body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const crop = parseImageCrop(preview.imageCrop);
  const imageFrameStyle =
    preview.imageUrl && imageMeta
      ? (() => {
          const zoom = crop?.zoom ?? 1;
          const baseScale = Math.min(EMAIL_IMAGE_WIDTH / imageMeta.width, EMAIL_IMAGE_HEIGHT / imageMeta.height);
          const fittedWidth = imageMeta.width * baseScale * zoom;
          const fittedHeight = imageMeta.height * baseScale * zoom;
          const horizontal = crop ? crop.x / 100 : 0.5;
          const vertical = crop ? crop.y / 100 : 0.5;

          return {
            width: `${fittedWidth}px`,
            height: `${fittedHeight}px`,
            left: `calc((100% - ${fittedWidth}px) * ${horizontal})`,
            top: `calc((100% - ${fittedHeight}px) * ${vertical})`
          };
        })()
      : null;

  return (
    <div className="leadBroadcastPreviewCard" ref={containerRef}>
      <div className="leadBroadcastPreviewHeader">
        <div>
          <strong>Previa do e-mail</strong>
          <small>
            A imagem entra em formato de banner para evitar aquele efeito de cartaz gigante na caixa de entrada.
          </small>
        </div>
        <span className="leadBroadcastPreviewTag">Antes de disparar</span>
      </div>

      <div className="leadBroadcastPreviewFrame">
        <div className="leadBroadcastPreviewMail">
          <p className="leadBroadcastPreviewBrand">{props.brandName}</p>
          <h3>{preview.subject || "Seu assunto vai aparecer aqui"}</h3>
          <p className="leadBroadcastPreviewGreeting">Ola, Diego.</p>

          {preview.imageUrl ? (
            <div className="leadBroadcastPreviewImageWrap">
              <div className="leadBroadcastPreviewImageStage">
                <img
                  alt={props.eventTitle}
                  className="leadBroadcastPreviewImage"
                  src={preview.imageUrl}
                  style={imageFrameStyle ?? undefined}
                />
              </div>
            </div>
          ) : (
            <div className="leadBroadcastPreviewImagePlaceholder">
              <strong>Imagem opcional</strong>
              <span>Prefira banner horizontal. Ex.: 1200 x 630 px.</span>
            </div>
          )}

          <div className="leadBroadcastPreviewBody">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
            ) : (
              <p>Sua mensagem aparece aqui conforme voce escreve.</p>
            )}
          </div>

          <div className="leadBroadcastPreviewFooter">
            <a className="leadBroadcastPreviewButton" href={preview.destinationUrl || "#"} onClick={(event) => event.preventDefault()}>
              {preview.ctaLabel || props.defaultCtaLabel}
            </a>
            {props.supportEmail ? <p>Suporte: {props.supportEmail}</p> : null}
            {preview.imageName ? <small>Imagem atual: {preview.imageName}</small> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
