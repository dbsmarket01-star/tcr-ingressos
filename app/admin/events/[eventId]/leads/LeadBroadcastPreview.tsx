"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseImageCrop } from "@/lib/image-crop";

type LeadBroadcastPreviewProps = {
  brandName: string;
  eventTitle: string;
  supportEmail?: string | null;
  defaultCtaLabel: string;
  defaultDestinationUrl: string;
  defaultInstagramUrl?: string;
};

type PreviewState = {
  subject: string;
  body: string;
  ctaLabel: string;
  destinationUrl: string;
  instagramUrl: string;
  imageUrl: string | null;
  imageName: string | null;
  imageCrop: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
};

function emptyPreviewState(props: LeadBroadcastPreviewProps): PreviewState {
  return {
    subject: "",
    body: "",
    ctaLabel: props.defaultCtaLabel,
    destinationUrl: props.defaultDestinationUrl,
    instagramUrl: props.defaultInstagramUrl || "",
    imageUrl: null,
    imageName: null,
    imageCrop: null,
    imageWidth: null,
    imageHeight: null
  };
}

function normalizeInstagramDisplay(value: string) {
  const text = value.trim();

  if (!text) {
    return "";
  }

  if (text.startsWith("@")) {
    return text;
  }

  const match = text.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (match?.[1]) {
    return `@${match[1]}`;
  }

  return `@${text.replace(/^@+/, "")}`;
}

export function LeadBroadcastPreview(props: LeadBroadcastPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(() => emptyPreviewState(props));

  useEffect(() => {
    const form = containerRef.current?.closest("form");

    if (!form) {
      return;
    }

    const subjectInput = form.querySelector<HTMLInputElement>('input[name="subject"]');
    const bodyInput = form.querySelector<HTMLTextAreaElement>('textarea[name="body"]');
    const ctaLabelInput = form.querySelector<HTMLInputElement>('input[name="ctaLabel"]');
    const destinationInput = form.querySelector<HTMLInputElement>('input[name="destinationUrl"]');
    const instagramInput = form.querySelector<HTMLInputElement>('input[name="instagramUrl"]');
    const imageInput = form.querySelector<HTMLInputElement>('input[name="imageFile"]');
    const imageCropInput = form.querySelector<HTMLInputElement>('input[name="imageCrop"]');
    const imageAppliedPreviewInput = form.querySelector<HTMLInputElement>('input[name="imageFileAppliedPreviewUrl"]');
    const imageWidthInput = form.querySelector<HTMLInputElement>('input[name="imageFileWidth"]');
    const imageHeightInput = form.querySelector<HTMLInputElement>('input[name="imageFileHeight"]');

    const updatePreview = () => {
      const nextImageFile = imageInput?.files?.[0] ?? null;
      const appliedPreviewUrl = imageAppliedPreviewInput?.value.trim() || null;

      if (imageUrlRef.current && imageUrlRef.current !== appliedPreviewUrl) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }

      const nextImageUrl = appliedPreviewUrl
        ? appliedPreviewUrl
        : nextImageFile
          ? URL.createObjectURL(nextImageFile)
          : null;

      if (nextImageFile && !appliedPreviewUrl) {
        imageUrlRef.current = nextImageUrl;
      }

      setPreview({
        subject: subjectInput?.value.trim() || "",
        body: bodyInput?.value || "",
        ctaLabel: ctaLabelInput?.value.trim() || props.defaultCtaLabel,
        destinationUrl: destinationInput?.value.trim() || props.defaultDestinationUrl,
        instagramUrl: instagramInput?.value.trim() || props.defaultInstagramUrl || "",
        imageUrl: nextImageUrl,
        imageName: nextImageFile?.name ?? null,
        imageCrop: imageCropInput?.value.trim() || null,
        imageWidth: Number(imageWidthInput?.value ?? 0) || null,
        imageHeight: Number(imageHeightInput?.value ?? 0) || null
      });
    };

    const disposers: Array<() => void> = [];
    const inputs = [subjectInput, bodyInput, ctaLabelInput, destinationInput, instagramInput, imageInput, imageCropInput].filter(
      (input): input is HTMLInputElement | HTMLTextAreaElement => Boolean(input)
    );

    inputs.forEach((input) => {
      const eventName = input instanceof HTMLInputElement && input.type === "file" ? "change" : "input";
      input.addEventListener(eventName, updatePreview);
      disposers.push(() => input.removeEventListener(eventName, updatePreview));
    });

    const syncAppliedPreview = () => updatePreview();
    window.addEventListener("lead-email-image-applied", syncAppliedPreview);
    disposers.push(() => window.removeEventListener("lead-email-image-applied", syncAppliedPreview));

    updatePreview();

    return () => {
      disposers.forEach((dispose) => dispose());

      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    };
  }, [props.defaultCtaLabel, props.defaultDestinationUrl, props.defaultInstagramUrl]);

  const paragraphs = preview.body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const instagramDisplay = normalizeInstagramDisplay(preview.instagramUrl);
  const previewImageUrl = useMemo(() => {
    if (!preview.imageUrl) {
      return null;
    }

    const params = new URLSearchParams({
      src: preview.imageUrl
    });

    if (preview.imageWidth && preview.imageHeight) {
      params.set("w", String(preview.imageWidth));
      params.set("h", String(preview.imageHeight));
    }

    const crop = parseImageCrop(preview.imageCrop);
    if (crop) {
      params.set("crop", JSON.stringify(crop));
    }

    return `/r/lead-email-image?${params.toString()}`;
  }, [preview.imageCrop, preview.imageHeight, preview.imageUrl, preview.imageWidth]);

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
          <div className="leadBroadcastPreviewLogoWrap">
            <div className="leadBroadcastPreviewLogoBadge">
              <img alt={props.brandName} className="leadBroadcastPreviewLogo" src="/brands/tcr-logomarca.png" />
            </div>
            <p className="leadBroadcastPreviewBrand">{props.brandName}</p>
          </div>
          <h3>{preview.subject || "Seu assunto vai aparecer aqui"}</h3>
          <p className="leadBroadcastPreviewGreeting">Ola, Diego.</p>

          {previewImageUrl ? (
            <div className="leadBroadcastPreviewImageWrap">
              <img alt={props.eventTitle} className="leadBroadcastPreviewImage" src={previewImageUrl} />
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
            {instagramDisplay ? (
              <p className="leadBroadcastPreviewInstagram">
                <span className="leadBroadcastPreviewInstagramIcon" aria-hidden="true">
                  IG
                </span>
                {instagramDisplay}
              </p>
            ) : null}
            {props.supportEmail ? <p>Suporte: {props.supportEmail}</p> : null}
            {preview.imageName ? <small>Imagem atual: {preview.imageName}</small> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
